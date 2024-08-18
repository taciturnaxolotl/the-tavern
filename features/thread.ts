import { prisma, slackApp } from '../index'
import { blog } from '../lib/Logger'
import { respond } from '../lib/quests'

const mention = async () => {
    slackApp.anyMessage(async ({ context, payload }) => {
        if (payload.subtype != undefined || !payload.thread_ts) return

        const thread = await prisma.threads.findFirst({
            where: {
                ts: payload.thread_ts,
                channel: payload.channel,
            },
        })

        if (!thread || thread.userID != payload.user) return

        blog(
            `${payload.user} triggered the message handler in ${payload.channel}`,
            'info'
        )

        await respond(context.say, payload)
    })
}

export default mention
