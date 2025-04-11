import introductionAgent from "./introduction";
import experienceAgent from "./experience";
// import technicalAgent from "./technical"; // Removed
import behavioralAgent from "./behavioral";
import candidateQuestionsAgent from "./candidateQuestions";
import closingAgent from "./closing";
import { injectTransferTools } from "../utils";

// Define the standard interview flow (without technical phase)
introductionAgent.downstreamAgents = [experienceAgent];
experienceAgent.downstreamAgents = [behavioralAgent]; // Skip technical
// technicalAgent.downstreamAgents = [behavioralAgent]; // Removed
behavioralAgent.downstreamAgents = [candidateQuestionsAgent];
candidateQuestionsAgent.downstreamAgents = [closingAgent];
// Closing agent is the end, no downstream agents needed by default
closingAgent.downstreamAgents = [];

// Create the agent set with transfer tools injected
const agents = injectTransferTools([
  introductionAgent,
  experienceAgent,
  // technicalAgent, // Removed
  behavioralAgent,
  candidateQuestionsAgent,
  closingAgent,
]);

export default agents; 