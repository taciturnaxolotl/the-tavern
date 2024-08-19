import { prisma, slackApp } from '../index'
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

        await context.client.reactions.add({
            name: thread.locked ? 'x' : 'hourglass_flip',
            channel: payload.channel,
            timestamp: payload.ts,
        })

        if (thread.locked) return

        // lock the thread
        await prisma.threads.update({
            where: { id: thread.id },
            data: { locked: true },
        })

        await respond(payload, thread.quest, thread.scene, thread.id)

        // unlock the thread
        await prisma.threads.update({
            where: { id: thread.id },
            data: { locked: false },
        })

        await context.client.reactions.add({
            name: 'checks-passed-octicon',
            channel: payload.channel,
            timestamp: payload.ts,
        })

        await context.client.reactions.remove({
            channel: payload.channel,
            timestamp: payload.ts,
            name: 'hourglass_flip',
        })
    })

    slackApp.event('message', async () => {})
}

export default mention
