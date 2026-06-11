import { OlvidClient } from "@olvid/bot-node"

export const daemonClient = {

  async sendMessage(discussions: bigint[], message: string) {
    try {
      const client = new OlvidClient()
      
      for (const discussionId of discussions) {
        await client.messageSend({
          discussionId: discussionId,
          body: message
        })
        console.log(`✅ [Daemon] Message sent to discussion: ${discussionId}`)
      }
      return true
      
    } catch (error) {
      console.error("❌ [Daemon] An error occurred while sending a message:", error)
      return false
    }
  },

  async getDiscussions(){
    try {
      const client = new OlvidClient()
      const discussions = client.discussionList()
      console.log("✅ [Daemon] Received getDiscussions async request.")
      
  
      const arrayDiscussions: any[] = []
      
      try {
        for await (const discussion of discussions) {
        
          if (!discussion || !discussion.id) continue
          
          arrayDiscussions.push(discussion)
          
          console.log(`➡️ Processed: ${discussion.title}`)
        }
      } catch (error) {
        console.warn("⚠️ Async request ended abruptly:", error)
      }
      
      // 3. Devolvemos el array lleno
      return arrayDiscussions
      
    } catch (error) {
      console.error("❌ [Daemon] A critical error occurred while getting discussions", error)
      // En caso de error fatal, devolvemos un array vacío para no romper el frontend
      return []
    }
  },


}