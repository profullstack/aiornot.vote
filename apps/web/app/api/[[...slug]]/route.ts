import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}
