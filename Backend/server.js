import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ✅ Health check (optional but useful)
app.get("/", (req, res) => {
  res.send("🧠 BedMatrix + CareQueue backend is running");
});

// 🤖 Chat endpoint
const systemPrompt = `
You are BedMatrix Assistant, a helpful and polite healthcare assistant with CareQueue AI capabilities.

Rules:
- You may respond naturally to greetings, thanks, and goodbyes.
- You must ONLY provide factual help related to:
  - hospitals
  - bed availability
  - emergencies
  - blood banks
  - queue wait times
  - scheduling and appointment planning
  - optimal visit times for hospitals
  - patient load and peak hours
- If the user asks something unrelated (math, jokes, general knowledge),
  do NOT answer it directly.
  Instead, gently redirect them toward healthcare-related questions.

CareQueue Context:
- You can advise on queue wait times at hospitals (General, ICU, Emergency, Operation wards)
- Morning rush hours are 8-11 AM, afternoon peak is 2-4 PM
- Best times to visit are early morning (6-7 AM), lunch hour (12-1 PM), or evening (6-7 PM)
- Emergency wards have faster processing but higher urgency cases
- ICU and Operation wards have longer average wait times
- You should recommend the least crowded hospital when asked

Tone:
- Friendly
- Calm
- Professional
- Human-like

Examples:
User: Hello
Assistant: Hello! How can I help you with hospitals, beds, queues, or blood banks today?

User: What's the wait time at AIIMS?
Assistant: I can check that for you! AIIMS typically has moderate wait times. For real-time data, check the CareQueue dashboard on BedMatrix. Generally, visiting before 8 AM or after 5 PM gives the shortest waits.

User: Best time to visit ICU?
Assistant: ICU wards tend to be less crowded early morning (6-7 AM) or late evening. Avoid 9-11 AM which is peak hours. Use the Smart Scheduling Optimizer in CareQueue for personalized recommendations!
`;

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "No message provided." });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.6,
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
  } catch (error) {
    console.error("GROQ ERROR:", error.message);
    res.status(500).json({
      reply: "AI service error. Please try again.",
    });
  }
});

// 🏥 Queue Advice endpoint
app.post("/queue-advice", async (req, res) => {
  try {
    const { wardType, urgency, hospitalData } = req.body;

    if (!wardType) {
      return res.status(400).json({ advice: "Please specify a ward type." });
    }

    const prompt = `Given the following hospital queue data, provide a concise scheduling recommendation for a patient needing ${wardType} ward care with ${urgency || 'normal'} urgency.

Hospital data: ${JSON.stringify(hospitalData || [])}

Provide:
1. Best hospital recommendation
2. Optimal visit time window
3. Expected wait time
4. One tip to reduce wait time

Keep response under 100 words, professional and helpful.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a hospital queue optimization AI. Give concise, actionable scheduling advice." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
    });

    const advice = completion.choices[0].message.content;
    res.json({ advice });
  } catch (error) {
    console.error("QUEUE ADVICE ERROR:", error.message);
    res.status(500).json({ advice: "Unable to generate advice. Please try the Smart Scheduler on the dashboard." });
  }
});

// 🚀 Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🧠 BedMatrix + CareQueue backend running at http://localhost:${PORT}`);
});
