const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your Netlify frontend
app.use(cors({
  origin: '*', // Allow all origins - change to your specific domain in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Parse JSON bodies
app.use(express.json());

// Ensure temp directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Store active conversions for progress tracking
const activeConversions = new Map();

// Conversion endpoint
app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { targetFormat } = req.body;
    if (!targetFormat) {
      return res.status(400).json({ error: 'Target format not specified' });
    }

    const conversionId = uuidv4();
    const inputPath = req.file.path;
    const targetExtension = targetFormat.split('/')[1];
    const outputFilename = `converted-${uuidv4()}.${targetExtension}`;
    const outputPath = path.join(outputsDir, outputFilename);

    // Store conversion info for progress tracking
    activeConversions.set(conversionId, {
      progress: 0,
      status: 'processing',
      outputPath: outputPath
    });

    // Start FFmpeg conversion
    const command = ffmpeg(inputPath);

    // Apply format-specific options
    if (targetFormat.startsWith('audio/')) {
      setupAudioConversion(command, targetExtension);
    } else if (targetFormat.startsWith('video/')) {
      setupVideoConversion(command, targetExtension);
    }

    // Set output path
    command.output(outputPath);

    // Progress tracking
    command.on('progress', (progress) => {
      const percent = Math.min(Math.round(progress.percent || 0), 99);
      const conv = activeConversions.get(conversionId);
      if (conv) {
        conv.progress = percent;
      }
    });

    // Completion handler
    command.on('end', () => {
      const conv = activeConversions.get(conversionId);
      if (conv) {
        conv.progress = 100;
        conv.status = 'complete';
      }

      // Send the converted file
      res.setHeader('Content-Type', targetFormat);
      res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
      
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);

      // Cleanup after sending
      fileStream.on('close', () => {
        cleanupFiles(inputPath, outputPath, conversionId);
      });
    });

    // Error handler
    command.on('error', (err) => {
      console.error('FFmpeg error:', err);
      activeConversions.delete(conversionId);
      cleanupFiles(inputPath, outputPath, conversionId);
      res.status(500).json({ error: 'Conversion failed: ' + err.message });
    });

    // Start conversion
    command.run();

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Progress endpoint
app.get('/progress/:conversionId', (req, res) => {
  const { conversionId } = req.params;
  const conv = activeConversions.get(conversionId);
  
  if (!conv) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  res.json({ 
    progress: conv.progress, 
    status: conv.status 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup audio conversion options
function setupAudioConversion(command, targetExtension) {
  switch (targetExtension) {
    case 'mp3':
      command.audioCodec('libmp3lame')
             .audioQuality(2)
             .noVideo();
      break;
    case 'wav':
      command.audioCodec('pcm_s16le')
             .noVideo();
      break;
    case 'aac':
      command.audioCodec('aac')
             .audioBitrate('192k')
             .noVideo();
      break;
    case 'flac':
      command.audioCodec('flac')
             .noVideo();
      break;
    case 'ogg':
      command.audioCodec('libvorbis')
             .noVideo();
      break;
    case 'm4a':
      command.audioCodec('aac')
             .audioBitrate('192k')
             .noVideo();
      break;
    default:
      command.audioCodec('libmp3lame')
             .noVideo();
  }
}

// Setup video conversion options
function setupVideoConversion(command, targetExtension) {
  switch (targetExtension) {
    case 'mp4':
      command.videoCodec('libx264')
             .audioCodec('aac')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    case 'webm':
      command.videoCodec('libvpx-vp9')
             .audioCodec('libopus')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    case 'avi':
      command.videoCodec('libxvid')
             .audioCodec('mp3')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    case 'mov':
      command.videoCodec('libx264')
             .audioCodec('aac')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad()
             .outputOptions(['-movflags', '+faststart']);
      break;
    case 'mkv':
      command.videoCodec('libx264')
             .audioCodec('aac')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    case 'mpeg':
      command.videoCodec('mpeg1video')
             .audioCodec('mp2')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('720x?')
             .autopad();
      break;
    case 'flv':
      command.videoCodec('flv')
             .audioCodec('aac')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    case 'wmv':
      command.videoCodec('wmv2')
             .audioCodec('wmav2')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
      break;
    default:
      command.videoCodec('libx264')
             .audioCodec('aac')
             .videoBitrate('2000k')
             .audioBitrate('128k')
             .size('1280x?')
             .autopad();
  }
}

// Cleanup function
function cleanupFiles(inputPath, outputPath, conversionId) {
  activeConversions.delete(conversionId);
  
  // Delete files after 5 minutes
  setTimeout(() => {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }, 5 * 60 * 1000);
}

// Periodic cleanup of old files
setInterval(() => {
  const now = Date.now();
  [uploadsDir, outputsDir].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          // Delete files older than 30 minutes
          if (now - stats.mtime.getTime() > 30 * 60 * 1000) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  });
}, 10 * 60 * 1000); // Run every 10 minutes

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload limit: 500MB`);
});
