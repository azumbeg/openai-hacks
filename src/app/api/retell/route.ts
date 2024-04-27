import { NextRequest } from "next/server";
import Retell from "retell-sdk";
import { AgentResponse } from "retell-sdk/resources/agent.mjs";
import { LlmResponse } from "retell-sdk/resources/llm.mjs";
import { PhoneNumberResponse } from "retell-sdk/resources/phone-number.mjs";
import { z } from "zod";

const BodySchema = z.object({
  cal_api_key: z.string(),
  cal_event_type_id: z.number(),
  agent_name: z.string(),
  company_name: z.string(),
});

const handler = async (request: NextRequest) => {
  const body = await request.json();

  const result = BodySchema.safeParse(body);

  if (!result.success) {
    const { errors } = result.error;
    const errorJson = {
      message: "Invalid query parameters",
      errors,
    };

    return new Response(JSON.stringify(errorJson), {
      status: 400,
    });
  }

  const { cal_api_key, cal_event_type_id, agent_name, company_name } =
    result.data;

  const retellClient = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
  });

  const llm: LlmResponse = await retellClient.llm.create({
    general_prompt: `Your name is ${agent_name} and you are a quoting and booking assistant for a painting company named ${company_name}. Your objective is to schedule an initial consultation and provice a quote for painting services. Communicate concisely and conversationally. Aim for responses in short, clear prose, ideally under 10 words. This succinct approach helps in maintaining clarity and focus during buyer interactions. Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the buyer. It's important to listen actively and empathize without overly agreeing with the buyer, ensuring that your professional opinion guides the procurement process.`,
    begin_message: `Hi, I'm ${agent_name} and I'm an assistant with ${company_name}. How can I help you today?`,
    starting_state: "determine_service",
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
        name: "determine_service",
        state_prompt:
          "You will determine whether the caller is interested in interior or exterior painting services. Once the founder replies, tell them that you'd be happy to give them a quote and book it for them. Once the user has provided their service type, transition to collect_square_footage_and_room_count.",
        edges: [
          {
            destination_state_name: "collect_square_footage_and_room_count",
            description:
              "Transition to collect the room count and square footage of the walls to be painted.",
          },
        ],
        tools: [],
      },
      {
        name: "collect_square_footage_and_room_count",
        state_prompt:
          "You will collect the number of rooms and the total square footage of the walls to be painted. After the user has provided their room count and square footage, transition to appointment_booking.",
        edges: [
          {
            destination_state_name: "appointment_booking",
            description:
              "Transition to book an appointment when square footage of the walls has been collected.",
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
            cal_api_key: cal_api_key,
            event_type_id: cal_event_type_id,
          },
          {
            type: "book_appointment_cal",
            name: "book_appointment",
            description: "Book an appointment for an initial consultation.",
            cal_api_key: cal_api_key,
            event_type_id: cal_event_type_id,
          },
        ],
      },
    ],
  });

  const agent: AgentResponse = await retellClient.agent.create({
    llm_websocket_url: llm.llm_websocket_url,
    webhook_url: "https://openai-hacks.vercel.app/api/webhook",
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
