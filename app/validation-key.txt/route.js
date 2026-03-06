import { NextResponse } from "next/server";

export async function GET() {
  const key =
    "abf141d56af7e553f2d188b1582bd87600ff7016c64dc3c276c55ca67bcefd814ed250041ad1d2a5c4b8767cd1fa90acb7e2096661f819e5bf663c5020ce29fd";

  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
