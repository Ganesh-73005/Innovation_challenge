import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic, Camera, Loader, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import './DiagnosisChat.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function DiagnosisChat({ customer, onLogout }) {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('initial');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (customer?.vehicles && customer.vehicles.length > 0) {
      setSelectedVehicle(customer.vehicles[0]);
    }

    // Add greeting message
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AI Diagnosis Assistant. I can help identify vehicle issues.\n\nYou can describe your problem using:\n• Text description\n• Voice message\n• Image (with or without text)\n\nPlease describe what\'s wrong with your vehicle.'
    }]);
  }, [customer]);

  const sendMessage = async (text, imageFileToSend = null) => {
    if ((!text.trim() && !imageFileToSend) || !selectedVehicle) return;

    const userMessage = {
      role: 'user',
      content: text || (imageFileToSend ? 'Image uploaded' : ''),
      image: imageFileToSend ? URL.createObjectURL(imageFileToSend) : null
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setImagePreview(null);
    setImageFile(null);
    setLoading(true);

    try {
      let response;
      let endpoint;

      if (stage === 'clarification' && conversationId && !imageFileToSend) {
        // Answering a clarification question
        endpoint = `${API_URL}/api/diagnose/answer`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            customer_id: customer.customer_id,
            answer: text
          })
        });
      } else if (imageFileToSend) {
        // Image with optional text
        endpoint = `${API_URL}/api/diagnose/image`;
        const formData = new FormData();
        formData.append('image', imageFileToSend);
        formData.append('customer_id', customer.customer_id);
        formData.append('vehicle_id', selectedVehicle.vehicle_id);
        if (conversationId) formData.append('conversation_id', conversationId);
        if (text) formData.append('text', text);

        response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });
      } else {
        // Initial symptom text
        endpoint = `${API_URL}/api/diagnose/text`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customer.customer_id,
            vehicle_id: selectedVehicle.vehicle_id,
            text: text,
            conversation_id: conversationId
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      if (data.stage === 'error') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Sorry, I couldn\'t process that. Please provide more details about your vehicle issue.'
        }]);
        setStage('initial');
      } else if (data.stage === 'clarification' && data.question) {
        setStage('clarification');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Question ${data.question_number} of ${data.total_questions}:\n\n${data.question}`
        }]);
      } else if (data.stage === 'estimation' && data.top_problems) {
        setStage('estimation');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Perfect! Based on your answers, I've identified the top 3 most likely issues:\n\n${data.top_problems.map((p, i) => `${i + 1}. ${p.problem_name}`).join('\n')}\n\nFetching cost estimates from all dealerships...`
        }]);

        setTimeout(() => {
          navigate(`/estimates/${data.conversation_id || conversationId}`);
        }, 2000);
      }
    } catch (err) {
      console.error('Error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Voice recording is not supported in your browser');
      return;
    }

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Send to backend
        setLoading(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('customer_id', customer.customer_id);
          formData.append('vehicle_id', selectedVehicle.vehicle_id);
          if (conversationId) formData.append('conversation_id', conversationId);

          const response = await fetch(`${API_URL}/api/diagnose/voice`, {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();

            if (data.conversation_id && !conversationId) {
              setConversationId(data.conversation_id);
            }

            // Add voice message
            setMessages(prev => [...prev, {
              role: 'user',
              content: '🎤 Voice message',
              isVoice: true
            }]);

            if (data.stage === 'clarification' && data.question) {
              setStage('clarification');
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Question ${data.question_number} of ${data.total_questions}:\n\n${data.question}`
              }]);
            } else if (data.stage === 'estimation' && data.top_problems) {
              setStage('estimation');
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Perfect! Based on your voice input, I've identified the top 3 most likely issues:\n\n${data.top_problems.map((p, i) => `${i + 1}. ${p.problem_name}`).join('\n')}\n\nFetching cost estimates...`
              }]);

              setTimeout(() => {
                navigate(`/estimates/${data.conversation_id || conversationId}`);
              }, 2000);
            } else if (data.stage === 'error') {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message || 'Sorry, I couldn\'t process that. Please try again.'
              }]);
            }
          }
        } catch (err) {
          console.error('Voice processing error:', err);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, there was an error processing your voice message. Please try typing instead.'
          }]);
        } finally {
          setLoading(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const handleSend = () => {
    if (imageFile) {
      sendMessage(inputText, imageFile);
    } else if (inputText.trim()) {
      sendMessage(inputText);
    }
  };

  return (
    <div className="diagnosis-page">
      <Sidebar onLogout={onLogout} activePage="diagnose" />

      <div className="main-content">
        <div className="chat-header">
          <h1>AI Diagnosis Assistant</h1>
          {selectedVehicle && (
            <div className="selected-vehicle" data-testid="selected-vehicle">
              {selectedVehicle.model} - {selectedVehicle.registration_number}
            </div>
          )}
        </div>

        <div className="chat-container card">
          <div className="messages" data-testid="messages-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`} data-testid={`message-${idx}`}>
                <div className="message-content">
                  {msg.image && (
                    <div className="message-image">
                      <img src={msg.image} alt="Uploaded" />
                    </div>
                  )}
                  {msg.isVoice && (
                    <div className="voice-indicator">🎤</div>
                  )}
                  <div className="message-text">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="message assistant">
                <div className="message-content">
                  <Loader className="spinner-icon" size={20} />
                  <span>Analyzing...</span>
                </div>
              </div>
            )}
          </div>

          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                className="remove-image-btn"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="input-area">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />

            <button
              className="btn-icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !selectedVehicle}
              title="Upload image"
            >
              <Camera size={20} />
            </button>

            <input
              data-testid="diagnosis-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={stage === 'clarification' ? "Answer the question..." : "Describe your vehicle issue..."}
              disabled={loading || !selectedVehicle}
            />

            <button
              className="btn-icon"
              onClick={handleVoiceRecording}
              disabled={loading || !selectedVehicle}
              title={isRecording ? "Stop recording" : "Record voice"}
              style={isRecording ? { color: 'red' } : {}}
            >
              <Mic size={20} />
            </button>

            <button
              data-testid="send-button"
              className="btn-icon"
              onClick={handleSend}
              disabled={loading || (!inputText.trim() && !imageFile)}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagnosisChat;