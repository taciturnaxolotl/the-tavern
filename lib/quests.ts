import type { AppMentionEvent, GenericMessageEvent } from 'slack-edge'
import { slackClient, openAIClient, prisma } from '..'
import type {
    ChatCompletion,
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources/index.mjs'
import { parse } from 'yaml'
import clog, { blog } from './Logger'
import { $ } from 'bun'

const file = await Bun.file('lib/quests.yaml').text()
const questsRaw: {
    characters: {
        [key: string]: {
            prompt: string
            image: string
        }
    }
    quests: {
        [key: string]: {
            description: string
            noshow?: boolean
            items: string
            scenes: {
                [key: string]: {
                    prompt: string
                    character: string
                }
            }
        }
    }
} = parse(file)

// Parse the quests into an array of quest arrays
const quests = Object.fromEntries(
    Object.entries(questsRaw.quests).map(([name, quest]) => {
        return [
            name,
            {
                description: quest.description,
                items: quest.items,
                noshow: quest.noshow,
                scenes: Object.entries(quest.scenes).map(([_, sceneData]) => {
                    return {
                        prompt: sceneData.prompt,
                        character: sceneData.character,
                    }
                }),
            },
        ]
    })
)

const characters = Object.fromEntries(
    Object.entries(questsRaw.characters).map(([name, character]) => [
        name,
        {
            name: name,
            prompt: character.prompt,
            image: character.image,
        },
    ])
)

const tools: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'list_quests',
            description: 'Lists the quests available to the user',
        },
    },
    {
        type: 'function',
        function: {
            name: 'choose_quest',
            description:
                'start quest for the user on the next turn; make sure to check list_quests to make sure its in the correct format',
            parameters: {
                type: 'object',
                properties: {
                    quest: {
                        type: 'string',
                    },
                },
                required: ['quest'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'next_scene',
            description:
                'switch to next scene; run this immediately after the user discovers the goal',
        },
    },
    {
        type: 'function',
        function: {
            name: 'reward',
            description: 'give the user a reward',
            parameters: {
                type: 'object',
                properties: {
                    reward: {
                        type: 'string',
                    },
                },
                required: ['reward'],
            },
        },
    },
]

export async function respond(
    event: AppMentionEvent | GenericMessageEvent,
    quest: string,
    scene: number,
    threadID: string,
    extraMessage?: boolean
) {
    const currentScene = quests[quest].scenes[scene]

    const initalMesssage = await slackClient.chat.postMessage({
        thread_ts: event?.ts,
        channel: event.channel,
        icon_url: characters[currentScene.character].image,
        username: currentScene.character,
        text: 'thinking...',
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'thinking... :spinning-parrot:',
                },
            },
        ],
    })

    let messages: ChatCompletionMessageParam[] = []

    if (event.thread_ts != undefined) {
        // get the contents of the thread
        const threadContents = await slackClient.conversations.replies({
            channel: event.channel,
            ts: event.thread_ts,
        })

        for (const message of threadContents.messages!) {
            // ignore the last message
            if (message.ts == initalMesssage.ts) continue

            if (message.user == event.user) {
                messages.push({
                    role: 'user',
                    content: message.text!,
                    name: message.user,
                })
            } else if ((message.bot_id = process.env.BOT_ID)) {
                messages.push({
                    role: 'assistant',
                    content: message.text!,
                    name: message.bot_profile?.name?.replaceAll(' ', '_'),
                })
            }
        }
    } else {
        messages.push({
            role: 'user',
            content: 'hi! what quest are there for me to do?',
        })
    }

    if (extraMessage)
        messages.push({
            role: 'user',
            content: 'hi! can you introduce your self?',
            name: event.user!,
        })

    const response = await toolWrapper(
        currentScene,
        event.user!,
        messages,
        threadID,
        scene,
        quest
    )

    await slackClient.chat.update({
        ts: initalMesssage.ts!,
        channel: initalMesssage.channel!,
        text: response.message!,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: response.message!,
                },
            },
        ],
    })

    console.log('response:', response)

    if (response.lockThread) {
        await slackClient.chat.postMessage({
            thread_ts: event.ts,
            channel: event.channel,
            text: 'You completed the quest!',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: 'You completed the quest! :tada:',
                    },
                },
                {
                    type: 'divider',
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: 'Congratulations on completing the quest! :trophy:\nIf you wish to start another please ping the bot again!',
                        },
                    ],
                },
            ],
        })
        return
    }

    if (response.newQuest != undefined || response.newScene != undefined)
        await respond(
            event,
            response.newQuest || quest,
            response.newScene || 0,
            threadID,
            true
        )
}

async function toolWrapper(
    currentScene: { prompt: string; character: string },
    userID: string,
    messages: ChatCompletionMessageParam[],
    threadID: string,
    sceneID: number,
    quest: string
) {
    messages.push(
        {
            role: 'system',
            content: currentScene.prompt,
        },
        {
            role: 'system',
            content: `${
                characters[currentScene.character].prompt
            } Answer in no more than a paragraph. The players's name is <@${userID}>; refer to them by it. Go to the next scene when the goal is completed by the user`,
        }
    )

    const completion = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        tools: getProperTools(
            sceneID === 0,
            sceneID === quests[quest].scenes.length - 1
        ),
    })

    return toolHandlerRecursive(
        completion,
        messages,
        threadID,
        sceneID,
        quest,
        userID
    )
}

async function toolHandlerRecursive(
    completion: ChatCompletion,
    messages: ChatCompletionMessageParam[],
    threadID: string,
    scene: number,
    quest: string,
    userID: string,
    newQuest?: string,
    newScene?: number,
    lockThread?: boolean
) {
    if (completion.choices[0].message.tool_calls?.length! > 0) {
        messages.push(completion.choices[0].message)
        for (const toolCall of completion.choices[0].message.tool_calls!) {
            blog('function call for ' + toolCall.function.name, 'info')
            switch (toolCall.function.name) {
                case 'list_quests': {
                    messages.push({
                        role: 'tool',
                        content: JSON.stringify(
                            Object.entries(quests)
                                .filter(([_, quest]) => !quest.noshow)
                                .map(([name, quest]) => ({
                                    name,
                                    description: quest.description,
                                }))
                        ),
                        tool_call_id: toolCall.id,
                    })
                    break
                }
                case 'choose_quest': {
                    const args = JSON.parse(toolCall.function.arguments)
                    // check if that quest exists
                    if (quests[args.quest] == undefined) {
                        messages.push({
                            role: 'tool',
                            content: `Quest ${args.quest} does not exist; please check list quests for proper formating`,
                            tool_call_id: toolCall.id,
                        })
                        break
                    }
                    await prisma.threads.update({
                        where: { id: threadID },
                        data: {
                            quest: args.quest,
                            scene: 0,
                        },
                    })
                    messages.push({
                        role: 'tool',
                        content: `switched quest`,
                        tool_call_id: toolCall.id,
                    })
                    newQuest = args.quest
                    break
                }
                case 'next_scene': {
                    const thread = await prisma.threads.findFirst({
                        where: {
                            id: threadID,
                        },
                    })
                    if (thread == null) {
                        messages.push({
                            role: 'tool',
                            content: `thread not found`,
                            tool_call_id: toolCall.id,
                        })
                        break
                    }
                    await prisma.threads.update({
                        where: { id: threadID },
                        data: {
                            scene: thread.scene + 1,
                        },
                    })
                    messages.push({
                        role: 'tool',
                        content: `switched scene`,
                        tool_call_id: toolCall.id,
                    })
                    newScene = thread.scene + 1
                    break
                }
                case 'reward': {
                    const args = JSON.parse(toolCall.function.arguments)
                    // check if its the last scene
                    if (scene != quests[quest].scenes.length - 1) {
                        messages.push({
                            role: 'tool',
                            content: `cannot reward user until the last scene`,
                            tool_call_id: toolCall.id,
                        })
                        blog('cannot reward user until the last scene', 'error')
                        break
                    }
                    lockThread = true
                    messages.push({
                        role: 'tool',
                        content: `gave user ${quests[quest].items}`,
                        tool_call_id: toolCall.id,
                    })
                    try {
                        // remove the thread
                        await prisma.threads.delete({
                            where: { id: threadID },
                        })

                        await $`node lib/give-items.js ${userID} ${
                            "'" + quests[quest].items + "'"
                        } ${
                            "'" +
                            'Thanks for completing the quest <@' +
                            userID +
                            '>!' +
                            "'"
                        }`
                        clog('gave user ' + quests[quest].items, 'info')
                    } catch (e) {
                        if (e instanceof Error) {
                            messages.push({
                                role: 'tool',
                                content: `error: ${e.message}`,
                                tool_call_id: toolCall.id,
                            })
                            blog(e.message, 'error')
                        }
                    }

                    break
                }
            }
        }

        const newCompletion = await openAIClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: getProperTools(
                scene === 0,
                scene === quests[quest].scenes.length - 1,
                lockThread
            ),
            max_tokens: 500,
        })

        return await toolHandlerRecursive(
            newCompletion,
            messages,
            threadID,
            scene,
            quest,
            userID,
            newQuest,
            newScene,
            lockThread
        )
    } else {
        return {
            message: completion.choices[0].message.content,
            newQuest,
            newScene,
            lockThread,
        }
    }
}

function getProperTools(
    getQuest?: boolean,
    finished?: boolean,
    rewardGiven?: boolean
) {
    // filter out the reward tool if not finished if it is then just give reward tool
    return tools.filter((tool) => {
        if (tool.function.name == 'reward') return !rewardGiven || finished
        if (tool.function.name == 'next_scene') return !finished
        if (tool.function.name == 'choose_quest') return getQuest
        if (tool.function.name == 'list_quests') return getQuest
        return true
    })
}
