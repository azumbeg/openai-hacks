import { NextRequest } from "next/server";
import Retell from "retell-sdk";
import { AgentResponse } from "retell-sdk/resources/agent.mjs";
import { LlmResponse } from "retell-sdk/resources/llm.mjs";
import { PhoneNumberResponse } from "retell-sdk/resources/phone-number.mjs";

const CAL_API_KEY = "cal_live_0443b3d029723a1d92facb2e800bc388";

const handler = async (request: NextRequest) => {
  const retellClient = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
  });

  const llm: LlmResponse = await retellClient.llm.create({
    general_prompt:
      "You're a front desk person for a painting company. Your job is to schedule an initial home consultation with clients who call in. You should ask them for the date/time that works best for them. You should also ask them the size of the room they want painted and provide a quote based on that information.",
    begin_message:
      "Hi, this is Kevin from San Francisco Home Painters, how can I help you?",
    starting_state: "collect_square_footage",
    general_tools: [
      {
        type: "end_call",
        name: "end_call",
        description:
          "Hang up the call, triggered only after appointment successfully scheduled.",
      },
    ],
    states: [
      {
        name: "collect_square_footage",
        state_prompt:
          "You will collect the square footage of the area to be painted. After the user has provided their square footage, transition to appointment_booking.",
        edges: [
          {
            destination_state_name: "appointment_booking",
            description:
              "Transition to book an appointment when square footage has been collected.",
          },
        ],
        tools: [],
      },
      {
        name: "appointment_booking",
        state_prompt:
          "You will book an appointment for an initial consultation with the client.",
        edges: [],
        tools: [
          {
            type: "check_availability_cal",
            name: "check_availability",
            description:
              "Check the availability of the painting company you work for.",
            cal_api_key: CAL_API_KEY,
            event_type_id: 619319,
          },
          {
            type: "book_appointment_cal",
            name: "book_appointment",
            description: "Book an appointment for an initial consultation.",
            cal_api_key: CAL_API_KEY,
            event_type_id: 619319,
          },
        ],
      },
    ],
  });

  const agent: AgentResponse = await retellClient.agent.create({
    llm_websocket_url: llm.llm_websocket_url,
    voice_id: "11labs-Adrian",
    agent_name: "Kevin",
  });

  const phone: PhoneNumberResponse = await retellClient.phoneNumber.create({
    agent_id: agent.agent_id,
  });

  return new Response(JSON.stringify(phone));
};

export async function POST(request: NextRequest) {
  return handler(request);
}
