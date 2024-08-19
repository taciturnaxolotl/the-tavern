import theTavern, { prisma, slackApp } from '../index'
import { blog } from '../lib/Logger'
import { respond } from '../lib/quests'

const mention = async () => {
    slackApp.event('app_mention', async ({ context, payload }) => {
        if (
            payload.user == undefined ||
            payload.subtype != undefined ||
            payload.thread_ts != undefined
        )
            return

        blog(
            `<@${payload.user}> started a quest in <#${payload.channel}>`,
            'info'
        )

        const thread = await prisma.threads.create({
            data: {
                userID: payload.user,
                ts: payload.ts,
                channel: payload.channel,
                locked: true,
            },
        })

        await respond(payload, thread.quest, thread.scene, thread.id)

        // unlock the thread
        await prisma.threads.update({
            where: { id: thread.id },
            data: { locked: false },
        })
    })
}

export default mention
