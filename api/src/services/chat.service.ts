import { forbidden, notFound } from "../lib/errors";
import { messagesRepo } from "../repositories/messages.repo";
import { ridesRepo } from "../repositories/rides.repo";

export const chatService = {
  async assertMember(rideId: string, userId: string) {
    if (!(await messagesRepo.isMember(rideId, userId))) {
      const ride = await ridesRepo.findById(rideId);
      if (!ride) throw notFound("Ride not found");
      throw forbidden("Only the host and confirmed guests can use this chat");
    }
  },
  async history(rideId: string, userId: string) {
    await this.assertMember(rideId, userId);
    return messagesRepo.list(rideId);
  },
  async send(rideId: string, userId: string, body: string) {
    await this.assertMember(rideId, userId);
    return messagesRepo.insert(rideId, userId, body.trim());
  },
};
