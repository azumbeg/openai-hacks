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
  price_per_square_foot: z.number(),
  max_discount: z.number(),
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

  const {
    cal_api_key,
    cal_event_type_id,
    agent_name,
    company_name,
    price_per_square_foot,
    max_discount,
  } = result.data;

  console.log({ cal_api_key, cal_event_type_id });

  const retellClient = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
  });

  const generalPrompt = `
      You are an quoting and booking assistant named ${agent_name}, you work for ${company_name}. 
      Your objective is to schedule an initial consultation and provide a quote for painting services.
      You are on a call with the buyer, who is interested in painting services.
      Communicate concisely and conversationally. Aim for responses in short, clear prose, ideally under 10 words.
      This succinct approach helps in maintaining clarity and focus during buyer interactions.
      Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the buyer.
      It's important to listen actively and empathize without overly agreeing with the buyer, ensuring that your professional opinion guides the quoting and scheduling process.

  `;

  const llm: LlmResponse = await retellClient.llm.create({
    general_prompt: generalPrompt,
    begin_message: `Hi, I'm ${agent_name} and I'm an assistant with ${company_name}. How can I help you today?`,
    starting_state: "get_name",
    general_tools: [],
    states: [
      {
        name: "get_name",
        state_prompt:
          "You will ask the buyer for their name. Once the buyer has provided their name, transition to determine_service.",
        edges: [
          {
            destination_state_name: "determine_service",
            description: "Transition to determine the service to be provided.",
          },
        ],
        tools: [],
      },
      {
        name: "determine_service",
        state_prompt:
          "You will determine whether the caller is interested in interior or exterior painting services. Once the buyer replies, tell them that you'd be happy to give them a quote and book it for them. Once the user has provided their service type, transition to collect_address.",
        edges: [
          {
            destination_state_name: "collect_address",
            description:
              "Transition to collect the address of the property to be painted.",
          },
        ],
        tools: [],
      },
      {
        name: "collect_address",
        state_prompt:
          "You will collect the address of the property to be painted. After the user provides the address, transition to collect_square_footage_and_room_count",
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
          "You will collect the number of rooms to be painted and the total square footage of the walls to be painted. After the user has provided the number of rooms and total square footage, transition to provide_quote.",
        edges: [
          {
            destination_state_name: "provide_quote",
            description:
              "Transition to provide a quote when the number of rooms and total square footage has been collected.",
          },
        ],
        tools: [],
      },
      {
        name: "provide_quote",
        state_prompt: `You will provide a quote which is ${price_per_square_foot} times the total square footage specified. Do not let the buyer negotiate more than a ${
          max_discount * 100
        }% discount. Once the buyer has confirmed the quote, transition to collect_email.`,
        edges: [
          {
            destination_state_name: "collect_email",
            description:
              "Transition to collect the caller's once the quote has been agreed upon.",
          },
        ],
        tools: [],
      },
      {
        name: "collect_email",
        state_prompt:
          "You will collect the email for the buyer so we can send them the quote and the appointment time. Once the email has been collected, transition to appointment_booking.",
        edges: [
          {
            destination_state_name: "appointment_booking",
            description:
              "Transition to book the appointment once the email has been collected.",
          },
        ],
      },
      {
        name: "appointment_booking",
        state_prompt:
          "You will book an initial appointment. Suggest 9am on April 29th and if the caller confirms, tell them the time slot was booked and that they'll receive email confirmation. Once the appointment has been booked, transition to finish_call.",
        edges: [
          {
            destination_state_name: "finish_call",
            description:
              "Transition to finish the call once the appointment has been booked.",
          },
        ],
        tools: [
          // {
          //   type: "check_availability_cal",
          //   name: "check_availability",
          //   description: "Check the availability of the company you work for.",
          //   cal_api_key: cal_api_key,
          //   event_type_id: cal_event_type_id,
          //   timezone: "America/Los_Angeles",
          // },
          // {
          //   type: "book_appointment_cal",
          //   name: "book_appointment",
          //   description: "Book an appointment for an initial consultation.",
          //   cal_api_key: cal_api_key,
          //   event_type_id: cal_event_type_id,
          //   timezone: "America/Los_Angeles",
          // },
        ],
      },
      {
        name: "finish_call",
        state_prompt:
          "You will thank the buyer for their time and tell them that we're excited to work with them. End the call when you think it is appropriate.",
        tools: [
          {
            type: "end_call",
            name: "end_call",
            description:
              "End the call, only when it is appropriate and all information has been collected.",
          },
        ],
      },
    ],
  });

  const agent: AgentResponse = await retellClient.agent.create({
    llm_websocket_url: llm.llm_websocket_url,
    webhook_url: "https://openai-hacks.vercel.app/api/webhook",
    voice_id: "11labs-Max",
    agent_name: agent_name,
  });

  const phone: PhoneNumberResponse = await retellClient.phoneNumber.create({
    agent_id: agent.agent_id,
  });

  return new Response(JSON.stringify(phone));
};

export async function POST(request: NextRequest) {
  return handler(request);
}
