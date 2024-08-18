import type {
    AppMentionEvent,
    ChatPostMessageRequest,
    ChatPostMessageResponse,
    GenericMessageEvent,
} from 'slack-edge'
import { slackClient, openAIClient } from '..'
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'

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

    let messages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content:
                'You are a the propriator of the tavern and you are gruff and rude but eventually warm up to the party. Answer in no more than a paragraph',
        },
    ]

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
                })
            } else if ((message.bot_id = process.env.BOT_ID)) {
                messages.push({
                    role: 'assistant',
                    content: message.text!,
                })
            }
        }
    } else {
        messages.push({
            role: 'user',
            content: event.text!,
        })
    }

    console.log(messages)

    const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
    })

    await slackClient.chat.update({
        ts: initalMesssage.ts!,
        channel: initalMesssage.channel!,
        text: response.choices[0].message.content!,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: response.choices[0].message.content!,
                },
            },
        ],
    })
}
