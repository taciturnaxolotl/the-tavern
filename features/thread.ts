import { slackApp } from '../index'
import { blog } from '../lib/Logger'
import { respond } from '../lib/quests'

const mention = async () => {
    slackApp.anyMessage(async ({ context, payload }) => {
        if (payload.subtype != undefined || !payload.thread_ts) return

        blog(
            `${payload.user} triggered the message handler in ${payload.channel}`,
            'info'
        )

        await respond(context.say, payload)
    })
}

export default mention
