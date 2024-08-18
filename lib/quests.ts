import type {
    AppMentionEvent,
    ChatPostMessageRequest,
    ChatPostMessageResponse,
} from 'slack-edge'
import { slackClient, openAIClient } from '..'

export async function respond(
    say: (
        params: Omit<ChatPostMessageRequest, 'channel'>
    ) => Promise<ChatPostMessageResponse>,
    appMentionEvent?: AppMentionEvent
) {
    const initalMesssage = await say({
        thread_ts: appMentionEvent?.ts,
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

    const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    'You are a the propriator of the tavern and you are gruff and rude but eventually warm up to the party.',
            },
            {
                role: 'user',
                content: appMentionEvent?.text!,
            },
        ],
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
