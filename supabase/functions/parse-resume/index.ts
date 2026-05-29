import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();
    
    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "File URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Fetch the file content
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error("Failed to fetch resume file");
    }

    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();
    const base64Content = btoa(
      new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Determine file type from URL extension
    const urlLower = fileUrl.toLowerCase();
    let mimeType = "application/octet-stream";
    
    if (urlLower.includes(".pdf")) {
      mimeType = "application/pdf";
    } else if (urlLower.includes(".docx")) {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (urlLower.includes(".doc")) {
      mimeType = "application/msword";
    } else if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) {
      mimeType = "image/jpeg";
    } else if (urlLower.includes(".png")) {
      mimeType = "image/png";
    } else if (urlLower.includes(".webp")) {
      mimeType = "image/webp";
    } else if (urlLower.includes(".heic") || urlLower.includes(".heif")) {
      mimeType = "image/heic";
    }

    console.log("Parsing resume from:", fileUrl, "MIME type:", mimeType);

    // Use Google Gemini API (OpenAI-compatible endpoint) for structured output
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a resume parser AI. Extract candidate information from the resume document provided. 
Be thorough and extract all available information. For fields not found in the resume, return null.
For experience years, calculate total years from work history if not explicitly stated.
For CTC (salary), look for current salary, expected salary, or compensation information in lakhs per annum.
For skills, extract all technical and soft skills mentioned.
Always validate phone numbers should be 10 digits for Indian numbers.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please parse this resume and extract candidate information using the provided function."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Content}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_candidate_info",
              description: "Extract structured candidate information from a resume",
              parameters: {
                type: "object",
                properties: {
                  first_name: { type: "string", description: "Candidate's first name" },
                  last_name: { type: "string", description: "Candidate's last name or surname" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Primary phone number (10 digits for India)" },
                  phone_secondary: { type: "string", description: "Secondary phone number if available" },
                  current_company: { type: "string", description: "Current or most recent employer" },
                  designation: { type: "string", description: "Current or most recent job title" },
                  total_experience_years: { type: "number", description: "Total years of work experience" },
                  current_ctc_lakhs: { type: "number", description: "Current CTC/salary in lakhs per annum" },
                  expected_ctc_lakhs: { type: "number", description: "Expected CTC/salary in lakhs per annum" },
                  notice_period_days: { type: "number", description: "Notice period in days" },
                  key_skills: { type: "string", description: "Comma-separated list of skills" },
                  highest_qualification: { type: "string", description: "Highest educational qualification" },
                  languages: { type: "string", description: "Languages known, comma-separated" },
                  current_location: { type: "string", description: "Current city/location" },
                  preferred_location: { type: "string", description: "Preferred work locations, comma-separated" },
                  linkedin_url: { type: "string", description: "LinkedIn profile URL if present" },
                  position_applied_for: { type: "string", description: "Position/role the candidate is seeking" }
                },
                required: ["first_name", "last_name"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_candidate_info" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI parsing failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract the tool call arguments
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_candidate_info") {
      throw new Error("Failed to extract candidate information from resume");
    }

    const candidateData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted candidate data:", candidateData);

    return new Response(
      JSON.stringify({ success: true, data: candidateData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error parsing resume:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to parse resume" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
