export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, mediaType, total } = req.body;

    if (!image || !mediaType) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel Project Settings > Environment Variables." 
      });
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: `This is a photo of a classroom attendance sheet. Numbers from 1 to ${total} are printed in a grid. The teacher has drawn a circle (or oval) around the roll numbers of PRESENT students; numbers with no circle around them are ABSENT. Carefully look at every number and determine which ones have a hand-drawn circle/oval mark around them. Respond with ONLY a raw JSON object, no markdown formatting, no code fences, no other text, in exactly this shape: {"present":[1,2,3]} — list only the circled (present) roll numbers, sorted ascending.` }
          ]
        }]
      })
    });

    const data = await anthropicResponse.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || "Anthropic API error" });
    }

    const textBlock = (data.content || []).map((b) => b.text || "").join("");
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: "Could not parse model response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}