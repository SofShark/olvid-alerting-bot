import { Formatting, AlertStatus } from "#shared/constants"
import { buildPollingDefaultMessage } from "#shared/pollingMessage"
import Handlebars from 'handlebars'


export const alertManager = {

  async getDiscussionList(){
    return await daemonClient.getDiscussions();
  },

  // Entry point for an incoming webhook. The alert is resolved by token and
  // carries its bundles. Each bundle is one output (audience + format).
  async processAlert(alert: any, payload: any) {
    console.log(`⚙️ Processing alert #${alert.id}: ${alert.title}`)

    if (alert.status !== AlertStatus.Active) {
      console.log(`The alert is not active (status: ${alert.status}) — skipping`)
      return
    }

    const bundles = alert.bundles ?? []
    if (bundles.length === 0) {
      console.warn(`⚠️ Alert #${alert.id} is active but has no bundles`)
      return
    }

    // Fire every bundle in parallel.
    await Promise.all(
      bundles.map((bundle: any) => this.processBundle(alert, bundle, payload))
    )
  },

  async processBundle(alert: any, bundle: any, payload: any) {
    // discussion_list arrives from Prisma as BigInt[]; normalise just in case.
    const discussions = (bundle.discussion_list ?? []).map((id: any) => BigInt(id))

    if (discussions.length === 0) {
      console.warn(`⚠️ Bundle #${bundle.id} of alert #${alert.id} has no discussion targets`)
      return
    }

    const message = this.formatMessage(alert, bundle, payload)
    await daemonClient.sendMessage(discussions, message)
  },

  formatMessage(alert: any, bundle: any, payload: any): string {
    const jsonString = JSON.stringify(payload, null, 2)

    switch (bundle.formating) {
      case Formatting.PollingDefault:
        return buildPollingDefaultMessage(alert, payload)

      case Formatting.PollingCustom:
      case Formatting.Custom: {
        // Both run a user-provided Handlebars template against the payload.
        // For polling, the payload is the parsed source tree; for webhook,
        // it's the raw posted JSON
        
        
        

  
        if (bundle.custom_script && bundle.custom_script.trim() !== '') {
          try {
            const template = Handlebars.compile(bundle.custom_script)
            return template(payload)
          } catch (error) {
            console.error(`❌ [Alert Manager] Error running script for bundle #${bundle.id} (alert #${alert.id}):`, error)
            return `🚨 **${alert.title}**\n⚠️ _Error running the custom script_\n\n\`\`\`json\n${jsonString}\n\`\`\``
          }
        }
        return `🚨 **${alert.title}**\n_${alert.description ?? ''}_\n\n\`\`\`json\n${jsonString}\n\`\`\``
      }

      case Formatting.Simple:
        return `🚨 ${alert.title}\n${alert.description ?? ''}\n`

      default:
        return `🚨 **${alert.title}**\n${alert.description ?? ''}\n\nTechnical data:\n${jsonString}`
    }
  }
}
