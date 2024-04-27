import OpenAI from "openai";
import { NextRequest } from "next/server";
import { z } from "zod";

import {
  Agent,
  Data,
  Lead,
  createItem,
  getItems,
} from "../../../../lib/helpers";
import { ChatCompletionTool } from "openai/resources/index.mjs";

const getAgentFromDb = async (agentId: string): Promise<Agent> => {
  const [agent] = await getItems<Agent>("agent", [
    { key: "agent_id_text", constraint_type: "equals", value: agentId },
  ]);

  return agent;
};

const NewLeadSchema = z.object({
  address: z.string(),
  appointment_date: z.string(),
  number_of_rooms: z.number(),
  quote_price: z.number(),
  square_footage: z.number(),
  service_type: z.string(),
});

type NewLead = Omit<Lead, keyof Data>;

const createLeadInDb = async (newLead: NewLead) => {
  await createItem<Lead>("lead", newLead);
};

const createLeadSchema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_lead",
    description: "Generate a new lead with the provided information",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "The address of the property",
        },
        appointment_date: {
          type: "string",
          description: "The date of the appointment",
        },
        number_of_rooms: {
          type: "number",
          description: "The number of rooms to be painted",
        },
        quote_price: {
          type: "number",
          description: "The agreed-upon price for the service",
        },
        service_type: {
          type: "string",
          description: "The type of painting service requested",
          enum: ["interior", "exterior"],
        },
        square_footage: {
          type: "number",
          description: "The square footage of the property",
        },
      },
      required: [
        "address",
        "appointment_date",
        "number_of_rooms",
        "quote_price",
        "service_type",
        "square_footage",
      ],
    },
  },
};

const handler = async (request: NextRequest) => {
  const body = await request.json();

  if (body.event === "call_ended") {
    const { agent_id, transcript } = body.data;

    console.log(body.data);

    // Get agent from DB
    const dbAgent = await getAgentFromDb(agent_id);

    // Extract structured data from phone call using transcript and OpenAI prompt
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      organization: process.env.OPENAI_ORG_ID || "",
    });

    const prompt = `
      You will be provided with a transcript of the phone call between customer and an agent at a painting company.
      The customer is booking an appointment for a painting service and requesting a quote.
      Your job is to extract the following information from the transcript and create a new lead in the system:
      - Address of the property
      - Appointment date
      - Number of rooms to be painted
      - Agreed-upon price quote for the service
      - Type of painting service requested (interior or exterior)
      - Square footage of the property

      If you are unable to extract any of the information, please leave it blank.
    `;

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: transcript },
      ],
      model: "gpt-4-turbo",
      tools: [createLeadSchema],
      tool_choice: {
        type: "function",
        function: { name: "create_lead" },
      },
    });

    let response;
    if (chatCompletion.choices[0].message.tool_calls?.[0].function.arguments) {
      response = JSON.parse(
        chatCompletion.choices[0].message.tool_calls[0].function.arguments
      );
    }

    const leadResult = NewLeadSchema.safeParse(response);

    // Create lead in DB
    if (leadResult.success) {
      const { data } = leadResult;
      await createLeadInDb({
        owner_user: dbAgent.owner_user,
        service_address_text: data.address,
        agent_custom_agent: dbAgent._id,
        appointment_date_date: data.appointment_date,
        num_rooms_number: data.number_of_rooms,
        quote_price_number: data.quote_price,
        service_type1_text: data.service_type,
        square_footage_number: data.square_footage,
      });
    }
  }

  return new Response("OK");
};

export async function POST(request: NextRequest) {
  try {
    const response = await handler(request);
    return response;
  } catch (error) {
    console.error(error);
    return new Response(`An error occurred while processing the request`, {
      status: 500,
    });
  }
}
