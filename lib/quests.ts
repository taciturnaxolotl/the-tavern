import type {
    AppMentionEvent,
    ChatPostMessageRequest,
    ChatPostMessageResponse,
    GenericMessageEvent,
} from 'slack-edge'
import { slackClient, openAIClient } from '..'
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { parse } from 'yaml'

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
            [key: string]: {
                prompt: string
                character: string
            }
        }
    }
} = parse(file)

// parse the quests into an array of quest arrays
const quests = Object.entries(questsRaw.quests).map(([questName, scenes]) => {
    const questScenes = Object.entries(scenes).map(([sceneName, scene]) => {
        return {
            prompt: scene.prompt,
            character: scene.character,
        }
    })
    return {
        name: questName,
        scenes: questScenes,
    }
})

const characters = Object.entries(questsRaw.characters).map(
    ([name, character]) => {
        return {
            name: name,
            prompt: character.prompt,
            image: character.image,
        }
    }
)

export async function respond(
    say: (
        params: Omit<ChatPostMessageRequest, 'channel'>
    ) => Promise<ChatPostMessageResponse>,
    event: AppMentionEvent | GenericMessageEvent
) {
    const initalMesssage = await say({
        thread_ts: event?.ts,
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
            content: event.text!,
        })
    }

    const response = await toolWrapper('', 0, event.user!, messages)

    await slackClient.chat.update({
        ts: initalMesssage.ts!,
        channel: initalMesssage.channel!,
        text: response,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: response,
                },
            },
        ],
    })
}

async function toolWrapper(
    quest: string,
    scene: number,
    userID: string,
    messages: ChatCompletionMessageParam[]
) {
    messages.push({
        role: 'system',
        content: `You are a the propriator of the tavern and you are gruff and rude but eventually warm up to the party. Answer in no more than a paragraph. Your name is McDuffy and you are scottish. The players's name is <@${userID}>; refer to them by it`,
    })

    const completion = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
    })

    return completion.choices[0].message.content!
}
