import mongoose from "mongoose";
import { initializeModels } from "../models/index.js";

mongoose.set("bufferCommands", false);
mongoose.set("autoIndex", false);

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await initializeModels();
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }

  console.log("MongoDB connected and StudySync indexes ready.");
}
