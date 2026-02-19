import { useState } from 'react';
import { Send, Bot, User, Sparkles, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SAMPLE_QUESTIONS_BY_INDUSTRY: Record<string, string[]> = {
  hvac: [
    "What's the proper procedure for checking refrigerant levels?",
    "What clearances does a gas furnace need per code?",
    "How do I troubleshoot an AC that's not cooling?",
    "What's the BTU calculation for room sizing?",
  ],
  plumbing: [
    "What's the minimum drain pipe size for a bathroom group?",
    "What are the venting requirements for a water heater?",
    "How do I locate a slab leak?",
    "What's the code for backflow preventer installation?",
  ],
  electrical: [
    "What are the GFCI requirements for kitchen outlets?",
    "What wire gauge is needed for a 40-amp circuit?",
    "How do I troubleshoot a tripping breaker?",
    "What's the NEC code for outdoor receptacle placement?",
  ],
  elevator: [
    "What's the ASME A17.1 inspection checklist for traction elevators?",
    "How do I troubleshoot a door operator malfunction?",
    "What are the fire recall test procedures?",
    "What's the code for pit ladder and lighting requirements?",
  ],
  home_automation: [
    "How do I troubleshoot a Zigbee device that won't pair?",
    "What's the recommended network setup for a 50+ device home?",
    "How do I configure a smart lock with Z-Wave?",
    "What are the best practices for outdoor camera placement?",
  ],
  mechanical: [
    "What's the LOTO procedure for conveyor maintenance?",
    "How do I diagnose excessive vibration in a pump?",
    "What are the alignment tolerances for shaft coupling?",
    "What's the PM schedule for a centrifugal compressor?",
  ],
  general: [
    "What safety precautions should I take before starting a repair?",
    "How do I calculate job cost estimates accurately?",
    "What documentation should I complete after a service call?",
    "What's the best way to handle warranty claims?",
  ],
};
const DEMO_RESPONSES: Record<string, string> = {
  default: "I'm the AI Field Assistant! In the full version, I can answer questions about equipment specifications, troubleshooting procedures, safety protocols, and more. I have access to manufacturer manuals and your company's knowledge base. With Code Reference mode, I can also cite US and Canadian building codes (NEC, CEC, IPC, NPC, IMC). Sign up to try the full experience!",
  refrigerant: "**Checking Refrigerant Levels - Step by Step:**\n\n1. Ensure the system has been running for at least 15 minutes\n2. Connect manifold gauges to service ports\n3. Compare readings to manufacturer specs on the data plate\n4. For R-410A systems, typical operating pressures are:\n   - Low side: 118-125 PSI\n   - High side: 375-425 PSI\n\n⚠️ Always wear safety glasses and gloves when handling refrigerants.\n\n*In the full version, I can look up specific specs for any equipment model!*",
  cooling: "**AC Not Cooling - Troubleshooting Checklist:**\n\n1. **Check thermostat settings** - Ensure it's set to cool and below room temp\n2. **Inspect air filter** - Dirty filters restrict airflow\n3. **Check outdoor unit** - Look for debris, ice, or obstructions\n4. **Listen for compressor** - Should hear it running\n5. **Check refrigerant levels** - Low charge indicates a leak\n\n🔧 Most common causes: Dirty coils (40%), Low refrigerant (25%), Capacitor failure (20%)\n\n*Sign up for full diagnostic decision trees and equipment-specific guides!*",
  safety: "**Furnace Repair Safety Checklist:**\n\n1. ⚡ **Turn off power** at breaker and disconnect\n2. 🔥 **Shut off gas** at the manual valve\n3. 👃 **Check for gas smell** before proceeding\n4. 🕐 **Allow cool-down time** (30+ minutes)\n5. 🔦 **Use proper lighting** - never open flames\n6. 🧤 **Wear PPE** - gloves, safety glasses\n\n**Never bypass safety switches or use the unit if you smell gas!**\n\n*Full safety protocols and OSHA guidelines available in the complete version.*",
  btu: "**BTU Calculation for Room Sizing:**\n\n**Quick Formula:**\nRoom Sq Ft × 20 = Base BTU needed\n\n**Adjustments:**\n- Sunny room: Add 10%\n- Kitchen: Add 4,000 BTU\n- Per occupant over 2: Add 600 BTU\n\n**Example:**\n300 sq ft living room = 6,000 BTU base\n+ South-facing windows = +600 BTU\n**Total: 6,600 BTU** (7,000-8,000 BTU unit recommended)\n\n*In the full app, I can calculate loads based on your specific job site details!*",
  gfci: "**GFCI Requirements for Kitchen Outlets:**\n\n**US — NEC 2023 Section 210.8(A)(6):**\nAll 125V, 15A and 20A receptacles serving countertop surfaces in dwelling unit kitchens require GFCI protection. This includes receptacles within 6 feet of the sink edge.\n[Source: NEC 2023 Section 210.8(A)(6)]\n\n**Canada — CEC Rule 26-710(g):**\nReceptacles within 1.5m of a sink in kitchens require GFCI protection.\n[Source: CEC 2024 Rule 26-710(g)]\n\n⚠️ *Always verify with your local AHJ — local amendments may apply.*\n\n*In the full app, Code Reference mode gives you instant access to NEC, CEC, IPC, NPC, and more!*",
  drain: "**Minimum Drain Pipe Sizes:**\n\n**US — IPC 2021 Table 710.1:**\n- Lavatory: 1-1/4\" minimum\n- Bathtub/shower: 1-1/2\" minimum (2\" recommended)\n- Water closet (toilet): 3\" minimum\n- Kitchen sink: 1-1/2\" minimum\n- Washing machine standpipe: 2\" minimum\n[Source: IPC 2021 Table 710.1]\n\n**Canada — NPC 2020 Table 7.4.9.3:**\n- Lavatory: 1-1/4\" (32mm)\n- Bathtub: 1-1/2\" (38mm)\n- Water closet: 3\" (75mm)\n[Source: NPC 2020 Table 7.4.9.3]\n\n⚠️ *Always verify with your local AHJ — local amendments may apply.*",
  clearance: "**Gas Furnace Clearance Requirements:**\n\n**US — IMC 2021 Table 303.10.1:**\n- Clearance to combustibles varies by appliance category\n- Typical forced-air furnace: 1\" sides and back, 6\" front service clearance\n- Single-wall vent connector: 6\" minimum from combustibles\n- B-vent connector: 1\" minimum from combustibles\n[Source: IMC 2021 Table 303.10.1]\n\n**Canada — CSA B149.1 Table 8.2:**\n- Similar clearance requirements per appliance listing\n- All gas work requires TSSA-licensed technician in Ontario\n[Source: CSA B149.1]\n\n⚠️ *Always check the manufacturer's data plate — it may require MORE clearance than code minimum.*",
};

export default function DemoAssistant() {
  const { industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const sampleQuestions = SAMPLE_QUESTIONS_BY_INDUSTRY[industry] || SAMPLE_QUESTIONS_BY_INDUSTRY.general;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm your AI Field Assistant. I can help with ${t('equipment').toLowerCase()} troubleshooting, procedures, and technical questions. Try asking me something or click one of the suggested questions below!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const getResponse = (question: string): string => {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('gfci') || lowerQ.includes('kitchen outlet')) {
      return DEMO_RESPONSES.gfci;
    }
    if (lowerQ.includes('drain') || lowerQ.includes('pipe size') || lowerQ.includes('bathroom group')) {
      return DEMO_RESPONSES.drain;
    }
    if (lowerQ.includes('clearance') || lowerQ.includes('furnace') && lowerQ.includes('code')) {
      return DEMO_RESPONSES.clearance;
    }
    if (lowerQ.includes('refrigerant') || lowerQ.includes('charge')) {
      return DEMO_RESPONSES.refrigerant;
    }
    if (lowerQ.includes('cooling') || lowerQ.includes('not cool') || lowerQ.includes('ac')) {
      return DEMO_RESPONSES.cooling;
    }
    if (lowerQ.includes('safety') || lowerQ.includes('precaution') || lowerQ.includes('furnace')) {
      return DEMO_RESPONSES.safety;
    }
    if (lowerQ.includes('btu') || lowerQ.includes('sizing') || lowerQ.includes('calculate')) {
      return DEMO_RESPONSES.btu;
    }
    return DEMO_RESPONSES.default;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 1500));

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getResponse(input),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col" data-tour="ai-chat">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Field Assistant
          </h1>
          <p className="text-muted-foreground">Ask questions about procedures, troubleshooting, and more</p>
        </div>
        <Button
          variant="outline"
          onClick={() => toast({
            title: "Demo Mode",
            description: "In the full app, you can customize the AI with your company's procedures and equipment manuals. Sign up to try it!",
          })}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Customize AI
        </Button>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                        {line.replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              <span>Try asking:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleSuggestionClick(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
