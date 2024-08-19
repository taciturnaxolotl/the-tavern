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
            },
        })

        await respond(payload, thread.quest, thread.scene, thread.id)
    })
}

export default mention
