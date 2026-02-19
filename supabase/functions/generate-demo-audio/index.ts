import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a consistent hash for a scene to use as filename
function generateSceneHash(sceneId: number, text: string): string {
  // Simple hash based on sceneId and first 50 chars of text
  const textSnippet = text.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '');
  return `scene-${sceneId}-${textSnippet.slice(0, 20)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, sceneId, voiceId = "JBFqnCBsd6RMkjVDRZzb" } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ error: "Storage service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fileName = `${generateSceneHash(sceneId ?? 0, text)}.mp3`;

    // Check if audio already exists in storage
    const { data: existingFile } = await supabase.storage
      .from('demo-audio')
      .getPublicUrl(fileName);

    // Verify the file actually exists by checking if we can access it
    if (existingFile?.publicUrl) {
      try {
        const checkResponse = await fetch(existingFile.publicUrl, { method: 'HEAD' });
        if (checkResponse.ok) {
          console.log(`[generate-demo-audio] Cache hit for ${fileName}`);
          return new Response(
            JSON.stringify({ 
              audioUrl: existingFile.publicUrl,
              cached: true,
              fileName 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        // File doesn't exist, continue to generate
      }
    }

    // File doesn't exist, generate new audio
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "TTS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-demo-audio] Generating audio for scene ${sceneId} (${text.length} chars)`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate audio", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[generate-demo-audio] Generated ${audioBuffer.byteLength} bytes`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('demo-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Still return the audio as base64 fallback
      const base64Audio = btoa(
        new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return new Response(
        JSON.stringify({ 
          audioContent: base64Audio,
          format: "mp3",
          size: audioBuffer.byteLength,
          cached: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('demo-audio')
      .getPublicUrl(fileName);

    console.log(`[generate-demo-audio] Uploaded and cached: ${fileName}`);

    return new Response(
      JSON.stringify({ 
        audioUrl: publicUrlData.publicUrl,
        cached: false,
        fileName,
        size: audioBuffer.byteLength 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating demo audio:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
