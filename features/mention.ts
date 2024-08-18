import { slackApp } from '../index'

const mention = async () => {
    slackApp.event('app_mention', async ({ context, payload }) => {
        console.log('Example Action', payload)
        await context.say({
            text: 'hi!',
            thread_ts: payload.ts,
        })
    })
}

export default mention
