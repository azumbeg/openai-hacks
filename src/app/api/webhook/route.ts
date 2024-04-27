import OpenAI from "openai";
import { NextRequest } from "next/server";
import { z } from "zod";

import { Agent, getItems } from "../../../../lib/helpers";
import { ChatCompletionTool } from "openai/resources/index.mjs";

const getAgentFromDb = async (agentId: string): Promise<Agent> => {
  const [agent] = await getItems<Agent>("agent", [
    { key: "agent_id_text", constraint_type: "equals", value: agentId },
  ]);

  return agent;
};

const createLeadInDb = async () => {};

const createLeadSchema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_lead",
    description: "Generate a new lead with the provided information",
    parameters: {
      type: "object",
      properties: {
        square_footage: {
          type: "number",
          description: "The square footage of the property",
        },
        service_type: {
          type: "string",
          description: "The type of painting service requested",
          enum: ["interior", "exterior"],
        },
        address: {
          type: "string",
          description: "The address of the property",
        },
        appointment_date: {
          type: "string",
          description: "The date of the appointment",
        },
      },
      required: [
        "square_footage",
        "service_type",
        "address",
        "appointment_date",
      ],
    },
  },
};

const handler = async (request: NextRequest) => {
  const body = await request.json();

  if (body.event === "call_ended") {
    const { agent_id, transcript } = body.data;

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
      - Square footage of the property
      - Type of painting service requested (interior or exterior)
      - Address of the property
      - Appointment date
    `;

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: transcript },
      ],
      model: "gpt-4-0125-preview",
      tools: [createLeadSchema],
      tool_choice: {
        type: "function",
        function: { name: "create_lead" },
      },
    });

    const LeadSchema = z.object({
      square_footage: z.number(),
      service_type: z.string(),
      address: z.string(),
      appointment_date: z.string(),
    });

    let response;
    if (chatCompletion.choices[0].message.tool_calls?.[0].function.arguments) {
      response = JSON.parse(
        chatCompletion.choices[0].message.tool_calls[0].function.arguments
      );
    }

    const leadResult = LeadSchema.safeParse(response);

    console.log({ leadResult });

    // Create lead in DB
  }
};

export async function POST(request: NextRequest) {
  return handler(request);
}

// process.env.BUBBLE_API_KEY = "03fa7a4f44e6cd09789e1d2a5882622b";
// getAgentFromDb("7191d2d48b0311ac95b259935b009ff0");
