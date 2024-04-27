import axios from "axios";

export interface Data {
  _id: string;
  "Created By"?: string;
  "Created Date": string;
  "Modified Date": string;
}

export interface Agent extends Data {
  agent_name_text: string;
  cal_api_key_text: string;
  cal_event_id_number: number;
  company_name_text: string;
  owner_user: string;
  phone_number_text: string;
  agent_id_text: string;
}

export interface Lead extends Data {
  owner_user: string;
  service_address_text: string;
  agent_custom_agent: string;
  scheduled_date_text: string;
  num_rooms_number: number;
  quote_price_number: number;
  service_type1_text: string;
  square_footage_number: number;
}

type ConstraintType =
  | "equals"
  | "not equal"
  | "is_empty"
  | "is_not_empty"
  | "text contains"
  | "not text contains"
  | "greater than"
  | "less than"
  | "in"
  | "not in"
  | "contains"
  | "not contains"
  | "empty"
  | "not empty"
  | "geographic_search";

export const baseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return "https://usemeli.com/api/1.1/obj";
  }

  return "https://usemeli.com/version-test/api/1.1/obj";
};

export type Constraint<T> = keyof T extends infer K
  ? K extends keyof T
    ? { key: K; constraint_type: ConstraintType; value?: T[K] | T[K][] }
    : never
  : never;

export const getItems = async <T>(
  dataType: string,
  constraints?: Constraint<T>[]
): Promise<T[]> => {
  const items: T[] = [];

  const fetchItems = async (
    dataType: string,
    cursor: number,
    constraints?: Constraint<T>[]
  ): Promise<any> => {
    const url = `${baseUrl()}/${dataType}`;

    const params = {
      cursor,
      api_token: process.env.BUBBLE_API_KEY,
      constraints: JSON.stringify(constraints) || null,
    };

    const { data } = await axios.get(url, { params });

    return data.response;
  };

  let cursor = 0;

  // Get first items
  const response = await fetchItems(dataType, cursor, constraints);
  items.push(...response.results);

  const totalItemCount = response.count + response.remaining;
  cursor += 100;

  const promises: Promise<any>[] = [];
  // Get remaining items and push promises to array and await them all
  while (cursor < totalItemCount) {
    promises.push(fetchItems(dataType, cursor, constraints));
    cursor += 100;
  }

  const results = await Promise.all(promises);
  for (const result of results) {
    items.push(...result.results);
  }

  return items;
};

export const createItem = async <T>(
  dataType: string,
  fields: Partial<Omit<T, keyof Data>>
): Promise<string> => {
  const url = `${baseUrl()}/${dataType}`;
  const params = {
    api_token: process.env.BUBBLE_API_KEY,
  };

  try {
    const { data } = await axios.post(url, fields, { params });
    return data.id;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.error(e.response);
      throw new Error("An axios error occurred");
    } else {
      throw new Error("An error occurred");
    }
  }
};

const main = async () => {
  const lead = await getItems("lead");
  console.log(lead);
};

process.env.BUBBLE_API_KEY = "03fa7a4f44e6cd09789e1d2a5882622b";
main();
