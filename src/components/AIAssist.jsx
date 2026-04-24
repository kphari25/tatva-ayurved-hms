import React, { useState } from 'react';
import { Brain, MessageSquare, Activity, Eye, Heart, Users, Sparkles, TrendingUp, AlertCircle, CheckCircle, Camera, Watch } from 'lucide-react';

const AIAssist = () => {
  const [activeTab, setActiveTab] = useState('intake');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const tabs = [
    { id: 'intake', label: 'Intelligent Intake', icon: MessageSquare },
    { id: 'prakriti', label: 'Prakriti Analysis', icon: Brain },
    { id: 'nadi', label: 'Nadi Pariksha', icon: Activity }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">AI Assist</h1>
            <p className="text-gray-600 text-sm">Ayurvedic Intelligence for Diagnosis & Patient Care</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md mb-6">
        <div className="flex border-b">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'intake' && <IntelligentIntake />}
      {activeTab === 'prakriti' && <PrakritiAnalysis />}
      {activeTab === 'nadi' && <NadiPariksha />}
    </div>
  );
};

// Intelligent Intake Component
const IntelligentIntake = () => {
  const [chatMessages, setChatMessages] = useState([
    {
      type: 'ai',
      message: 'Namaste! I\'m your AI Ayurvedic Assistant. I\'ll help gather your health information in a natural conversation. Let\'s begin with your name and age.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [intakeProgress, setIntakeProgress] = useState({
    personal: false,
    lifestyle: false,
    symptoms: false,
    history: false
  });

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    // Add user message
    const newMessages = [
      ...chatMessages,
      {
        type: 'user',
        message: userInput,
        timestamp: new Date().toISOString()
      }
    ];

    // Simulate AI response (in production, this would call Claude API)
    setTimeout(() => {
      const aiResponse = generateAIResponse(userInput, chatMessages.length);
      setChatMessages([
        ...newMessages,
        {
          type: 'ai',
          message: aiResponse,
          timestamp: new Date().toISOString()
        }
      ]);
    }, 1000);

    setChatMessages(newMessages);
    setUserInput('');
  };

  const generateAIResponse = (input, messageCount) => {
    // Simulated intelligent responses based on conversation flow
    const responses = [
      "Thank you! Now, tell me about your daily routine. What time do you usually wake up and sleep?",
      "Great! How would you describe your appetite and digestion? Do you prefer hot or cold foods?",
      "I understand. Can you describe any current health concerns or symptoms you're experiencing?",
      "Thank you for sharing. Do you have any history of chronic conditions or ongoing treatments?",
      "Excellent! Based on our conversation, I'm analyzing your responses using Ayurvedic principles. Let me prepare a comprehensive intake summary for your physician."
    ];
    
    return responses[Math.min(messageCount / 2, responses.length - 1)];
  };

  const progressItems = [
    { key: 'personal', label: 'Personal Info', icon: Users },
    { key: 'lifestyle', label: 'Lifestyle & Diet', icon: Heart },
    { key: 'symptoms', label: 'Symptoms', icon: AlertCircle },
    { key: 'history', label: 'Medical History', icon: Activity }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Interface - 2/3 width */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden flex flex-col" style={{ height: '600px' }}>
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Health Assistant</h2>
              <p className="text-xs text-purple-100">Natural language intake conversation</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-md px-4 py-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-800 shadow-md border border-gray-200'
                }`}
              >
                {msg.type === 'ai' && (
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-600">AI Assistant</span>
                  </div>
                )}
                <p className="text-sm">{msg.message}</p>
                <p className={`text-xs mt-1 ${msg.type === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your response..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Progress & Quick Actions - 1/3 width */}
      <div className="space-y-6">
        {/* Progress Tracker */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-bold text-gray-800 mb-4">Intake Progress</h3>
          <div className="space-y-3">
            {progressItems.map(item => {
              const Icon = item.icon;
              const isComplete = intakeProgress[item.key];
              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isComplete ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isComplete ? 'bg-green-600' : 'bg-gray-300'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isComplete ? 'text-green-800' : 'text-gray-600'
                  }`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Suggestions */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-bold text-gray-800 mb-4">Quick Suggestions</h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm">
              Tell me about your sleep pattern
            </button>
            <button className="w-full text-left px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm">
              Describe your energy levels
            </button>
            <button className="w-full text-left px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm">
              What foods do you crave?
            </button>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-md p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold">AI Insights</h3>
          </div>
          <p className="text-sm text-purple-100">
            Based on the conversation, I'm detecting patterns that may indicate Vata imbalance. Continue the intake for detailed analysis.
          </p>
        </div>
      </div>
    </div>
  );
};

// Prakriti Analysis Component
const PrakritiAnalysis = () => {
  const [analysisData, setAnalysisData] = useState({
    vata: 35,
    pitta: 40,
    kapha: 25,
    dominantDosha: 'Pitta',
    vikriti: {
      vata: 45,
      pitta: 35,
      kapha: 20
    }
  });

  const doshaColors = {
    vata: '#8b5cf6',
    pitta: '#ef4444',
    kapha: '#10b981'
  };

  const DoshaCard = ({ name, percentage, color, description }) => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">{name}</h3>
        <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        ></div>
      </div>

      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Analysis Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-800">Visual Analysis</h3>
          </div>
          <p className="text-sm text-gray-600">Tongue & eye examination using AI vision</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full">
            Start Camera
          </button>
        </button>

        <button className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Watch className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-800">Wearable Sync</h3>
          </div>
          <p className="text-sm text-gray-600">Connect fitness tracker for vital signs</p>
          <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 w-full">
            Connect Device
          </button>
        </button>

        <button className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-800">Intake Data</h3>
          </div>
          <p className="text-sm text-gray-600">Use AI intake conversation data</p>
          <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 w-full">
            Analyze
          </button>
        </button>
      </div>

      {/* Prakriti Analysis */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Prakriti (Constitution)</h2>
            <p className="text-sm text-gray-600">Natural dosha balance</p>
          </div>
          <div className="px-4 py-2 bg-purple-100 rounded-lg">
            <span className="text-sm font-semibold text-purple-800">Dominant: {analysisData.dominantDosha}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DoshaCard
            name="Vata"
            percentage={analysisData.vata}
            color={doshaColors.vata}
            description="Air & Space - Movement, creativity, flexibility"
          />
          <DoshaCard
            name="Pitta"
            percentage={analysisData.pitta}
            color={doshaColors.pitta}
            description="Fire & Water - Metabolism, digestion, intelligence"
          />
          <DoshaCard
            name="Kapha"
            percentage={analysisData.kapha}
            color={doshaColors.kapha}
            description="Earth & Water - Structure, stability, immunity"
          />
        </div>
      </div>

      {/* Vikriti Analysis */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Vikriti (Current Imbalance)</h2>
            <p className="text-sm text-gray-600">Present dosha state</p>
          </div>
          <div className="px-4 py-2 bg-orange-100 rounded-lg">
            <span className="text-sm font-semibold text-orange-800">Imbalance Detected: Vata ↑</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DoshaCard
            name="Vata"
            percentage={analysisData.vikriti.vata}
            color={doshaColors.vata}
            description="Elevated - May cause anxiety, dry skin, irregular digestion"
          />
          <DoshaCard
            name="Pitta"
            percentage={analysisData.vikriti.pitta}
            color={doshaColors.pitta}
            description="Normal - Balanced metabolism and energy"
          />
          <DoshaCard
            name="Kapha"
            percentage={analysisData.vikriti.kapha}
            color={doshaColors.kapha}
            description="Low - May need nourishment and grounding"
          />
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-md p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6" />
          <h3 className="text-xl font-bold">AI Treatment Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🌿 Herbs</h4>
            <p className="text-sm text-purple-100">Ashwagandha for Vata pacification, Brahmi for mental calm</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🍽️ Diet</h4>
            <p className="text-sm text-purple-100">Warm, cooked foods; avoid cold, raw items; favor sweet, sour, salty tastes</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🧘 Lifestyle</h4>
            <p className="text-sm text-purple-100">Regular routine, oil massage (Abhyanga), warm baths, early sleep</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <h4 className="font-semibold mb-2">💆 Therapies</h4>
            <p className="text-sm text-purple-100">Shirodhara, Basti (medicated enema), warm oil treatments</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Nadi Pariksha Component
const NadiPariksha = () => {
  const [isReading, setIsReading] = useState(false);
  const [pulseData, setPulseData] = useState({
    vata: { strength: 65, rhythm: 'Irregular', speed: 'Fast' },
    pitta: { strength: 45, rhythm: 'Regular', speed: 'Moderate' },
    kapha: { strength: 30, rhythm: 'Slow', speed: 'Steady' }
  });

  return (
    <div className="space-y-6">
      {/* Sensor Connection */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Nadi Pariksha Interpreter</h2>
            <p className="text-sm text-gray-600">Real-time pulse analysis system</p>
          </div>
          <button
            onClick={() => setIsReading(!isReading)}
            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 ${
              isReading
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <Activity className="w-5 h-5" />
            {isReading ? 'Stop Reading' : 'Start Reading'}
          </button>
        </div>

        {/* Sensor Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-600 animate-pulse"></div>
              <span className="text-sm font-semibold text-green-800">Sensor Connected</span>
            </div>
            <p className="text-xs text-green-600">Nadi sensor active on right wrist</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Heart Rate: 72 bpm</span>
            </div>
            <p className="text-xs text-blue-600">Normal rhythm detected</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">Signal Quality: 95%</span>
            </div>
            <p className="text-xs text-purple-600">Excellent reading</p>
          </div>
        </div>

        {/* Live Waveform Simulation */}
        <div className="bg-gray-900 rounded-lg p-4 h-32 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            {isReading ? (
              <svg className="w-full h-full" viewBox="0 0 800 100">
                <path
                  d="M0,50 Q10,30 20,50 T40,50 Q50,30 60,50 T80,50 Q90,30 100,50 T120,50"
                  stroke="#10b981"
                  strokeWidth="2"
                  fill="none"
                  className="animate-pulse"
                />
              </svg>
            ) : (
              <p className="text-gray-500 text-sm">Click "Start Reading" to begin pulse analysis</p>
            )}
          </div>
        </div>
      </div>

      {/* Dosha Pulse Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vata Pulse */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Vata Pulse</h3>
              <p className="text-xs text-gray-500">Superficial, Index finger</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Strength</span>
                <span className="font-semibold text-purple-600">{pulseData.vata.strength}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-purple-600 transition-all"
                  style={{ width: `${pulseData.vata.strength}%` }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rhythm:</span>
              <span className="font-semibold">{pulseData.vata.rhythm}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Speed:</span>
              <span className="font-semibold">{pulseData.vata.speed}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-800">
              <strong>AI Insight:</strong> Elevated Vata indicates increased movement and irregularity
            </p>
          </div>
        </div>

        {/* Pitta Pulse */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Pitta Pulse</h3>
              <p className="text-xs text-gray-500">Medium, Middle finger</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Strength</span>
                <span className="font-semibold text-red-600">{pulseData.pitta.strength}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-red-600 transition-all"
                  style={{ width: `${pulseData.pitta.strength}%` }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rhythm:</span>
              <span className="font-semibold">{pulseData.pitta.rhythm}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Speed:</span>
              <span className="font-semibold">{pulseData.pitta.speed}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-800">
              <strong>AI Insight:</strong> Normal Pitta shows balanced metabolism and heat
            </p>
          </div>
        </div>

        {/* Kapha Pulse */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Kapha Pulse</h3>
              <p className="text-xs text-gray-500">Deep, Ring finger</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Strength</span>
                <span className="font-semibold text-green-600">{pulseData.kapha.strength}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-green-600 transition-all"
                  style={{ width: `${pulseData.kapha.strength}%` }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rhythm:</span>
              <span className="font-semibold">{pulseData.kapha.rhythm}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Speed:</span>
              <span className="font-semibold">{pulseData.kapha.speed}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-800">
              <strong>AI Insight:</strong> Low Kapha may indicate need for grounding and nourishment
            </p>
          </div>
        </div>
      </div>

      {/* Comprehensive Report */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-md p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-6 h-6" />
          <h3 className="text-xl font-bold">AI-Synthesized Nadi Report</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">🔍 Primary Findings</h4>
            <ul className="text-sm space-y-1 text-blue-100">
              <li>• Vata pulse elevated - indicates air element excess</li>
              <li>• Pitta pulse balanced - good digestive fire</li>
              <li>• Kapha pulse low - potential dryness/depletion</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">💊 Recommended Actions</h4>
            <ul className="text-sm space-y-1 text-blue-100">
              <li>• Vata-pacifying herbs (Ashwagandha, Bala)</li>
              <li>• Warm oil massage therapy (Abhyanga)</li>
              <li>• Increase Kapha with nourishing foods</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-4 bg-white bg-opacity-20 rounded-lg">
          <p className="text-sm">
            <strong>Clinical Correlation:</strong> Nadi readings align with patient's reported symptoms of anxiety, irregular sleep, and dry skin - classic Vata imbalance markers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssist;
