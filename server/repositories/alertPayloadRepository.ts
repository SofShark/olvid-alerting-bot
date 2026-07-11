
export const alertPayloadRepository = {
    async upsertLastAlertPayload(alertId: number, payload: any) {
        await prisma.lastAlertPayload.upsert({
        where: { alertId },
        create: { alertId, payload },
        update: { payload },
        });
    },
    
    async getLastAlertPayload(alertId: number) {
        const row = await prisma.lastAlertPayload.findUnique({
        where: { alertId },
        select: { payload: true, receivedAt: true },
        });
        return row ?? null;
    },
    
    /** Failures are tracked separately so a subsequent success doesn't erase
     *  the diagnostic trail. `null`-able fields are allowed (e.g. the response
     *  never arrived, so no raw text). */
    async upsertLastFailedPayload(
        alertId: number,
        info: { raw?: string | null; parsed?: any; error: string; stage?: string },
    ) {
        const data = {
        raw: info.raw ?? null,
        parsed: info.parsed ?? null,
        error: info.error,
        stage: info.stage ?? null,
        };
        await prisma.lastFailedPayload.upsert({
        where: { alertId },
        create: { alertId, ...data },
        update: data,
        });
    },
    
    async getLastFailedPayload(alertId: number) {
        const row = await prisma.lastFailedPayload.findUnique({
        where: { alertId },
        select: {
            raw: true,
            parsed: true,
            error: true,
            stage: true,
            failedAt: true,
        },
        });
        return row ?? null;
    },
}