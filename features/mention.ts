import { slackApp } from '../index'
import { blog } from '../lib/Logger'
import { respond } from '../lib/quests'

const mention = async () => {
    slackApp.event('app_mention', async ({ context, payload }) => {
        blog(
            `${payload.user_profile?.display_name} triggered the app mention in ${payload.channel}`,
            'info'
        )
        await respond(context.say, payload)
    })
}

export default mention
