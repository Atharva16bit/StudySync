import { User } from "./User.js";
import { Session } from "./Session.js";
import { Group } from "./Group.js";
import { Membership } from "./Membership.js";
import { Invite } from "./Invite.js";
import { Resource } from "./Resource.js";
import { Message } from "./Message.js";
import { WhiteboardStroke } from "./WhiteboardStroke.js";
import { Quiz } from "./Quiz.js";
import { QuizAttempt } from "./QuizAttempt.js";
import { TutorProfile } from "./TutorProfile.js";
import { TutorSlot } from "./TutorSlot.js";
import { Booking } from "./Booking.js";

const models = [
  User,
  Session,
  Group,
  Membership,
  Invite,
  Resource,
  Message,
  WhiteboardStroke,
  Quiz,
  QuizAttempt,
  TutorProfile,
  TutorSlot,
  Booking,
];

export async function initializeModels() {
  for (const model of models) {
    await model.createIndexes();
  }
}
