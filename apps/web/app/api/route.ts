import { NextResponse } from "next/server";

export const runtime = "edge";

function jsonNotFound() {
  return NextResponse.json(
    { error: "Not found. See /api-docs for API documentation." },
    { status: 404 },
  );
}

export async function GET() {
  return jsonNotFound();
}

export async function POST() {
  return jsonNotFound();
}

export async function PUT() {
  return jsonNotFound();
}

export async function PATCH() {
  return jsonNotFound();
}

export async function DELETE() {
  return jsonNotFound();
}

export async function OPTIONS() {
  return jsonNotFound();
}

export async function HEAD() {
  return jsonNotFound();
}
