const mongoose = require('mongoose');

const ClipStatus = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  READY_FOR_GENERATION: 'ready_for_generation',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const GeneratedClipSchema = new mongoose.Schema({
  clipId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
  duration: { type: Number, required: true },
  transcript: { type: String, required: true },
  hashtags: [String],
  videoUrl: String,
  clipUrl: String, // AWS S3 URL
  fileSize: Number,
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: String,
  generatedAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} }
});

const ClipSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // File information
  rawFileUrl: { type: String, required: true },
  rawFileName: String,
  rawFileSize: Number,
  awsFileUrl: String, // AWS S3 URL for uploaded files
  
  // SRT file information
  srtFileUrl: String,
  srtFileName: String,
  srtContent: String,
  
  // Processing status and results
  status: {
    type: String,
    enum: Object.values(ClipStatus),
    default: ClipStatus.PENDING
  },
  
  // Generated clips
  generatedClips: [GeneratedClipSchema],
  
  // Processing metadata
  totalDuration: { type: Number, default: 0 },
  selectedModel: String,
  selectedTheme: Object,
  requestedClipCount: Number,
  
  // Token usage and costs
  totalTokensUsed: { type: Number, default: 0 },
  estimatedCost: { type: Number, default: 0 },
  
  // Timestamps
  generationStartedAt: Date,
  generationCompletedAt: Date,
  completedAt: Date,
  
  // Error handling
  errorMessage: String,
  
  // Additional metadata
  metadata: { type: Object, default: {} },
  
  // AWS metadata
  awsMetadata: {
    uploadSessionId: String,
    bucket: String,
    key: String,
    region: String,
    uploadedAt: Date
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
ClipSchema.index({ userId: 1, createdAt: -1 });
ClipSchema.index({ status: 1 });
ClipSchema.index({ createdAt: -1 });

module.exports = {
  Clip: mongoose.model('Clip', ClipSchema),
  ClipStatus,
  GeneratedClipSchema
};
