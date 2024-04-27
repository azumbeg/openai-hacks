import { NextRequest } from "next/server";

const handler = async (request: NextRequest) => {
  const body = await request.json();

  console.log(body);
};

export async function POST(request: NextRequest) {
  return handler(request);
}
