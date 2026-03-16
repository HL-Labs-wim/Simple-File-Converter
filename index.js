// Grab elements from the DOM
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const formatSelect = document.getElementById('formatSelect');
const imageToConvert = document.getElementById('imageToConvert');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const conversionStatus = document.getElementById('conversionStatus');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');

// FFmpeg setup
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    progress: ({ ratio }) => {
        const percentage = Math.round(ratio * 100);
        updateProgress(percentage);
    }
});

let isFFmpegLoaded = false;

// Update progress UI
function updateProgress(percentage) {
    progressFill.style.width = percentage + '%';
    statusText.textContent = `Converting... ${percentage}%`;
}

// Show/hide conversion status
function showConversionStatus(show = true) {
    conversionStatus.style.display = show ? 'block' : 'none';
    if (show) {
        progressFill.style.width = '0%';
        statusText.textContent = 'Initializing...';
    }
}

// LISTEN: Update filename when a user chooses a file
fileInput.addEventListener('change', function() {
    if (this.files && this.files.length > 0) {
        fileNameDisplay.textContent = this.files[0].name;
        fileNameDisplay.parentElement.style.borderColor = "#333";
        fileNameDisplay.parentElement.style.backgroundColor = "#e6fffa"; 
    } else {
        fileNameDisplay.textContent = "Choose File";
    }
});

// ACTION: The main conversion function
async function convertFile() {
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const fileType = file.type.split('/')[0];
    const selectedFormat = formatSelect.value;
    const targetFormat = selectedFormat.split('/')[0];

    // Validate conversion rules
    if (fileType === 'image' && targetFormat !== 'image') {
        alert("Images can only be converted to other image formats.");
        return;
    }
    
    if (fileType === 'audio' && (targetFormat !== 'audio' && targetFormat !== 'video')) {
        alert("Audio files can only be converted to other audio or video formats.");
        return;
    }
    
    if (fileType === 'video' && (targetFormat !== 'video' && targetFormat !== 'audio')) {
        alert("Video files can only be converted to other video or audio formats.");
        return;
    }

    if (fileType === 'image' && targetFormat === 'image') {
        convertImage();
    } else if (fileType === 'video' || fileType === 'audio') {
        await convertWithFFmpeg(file, selectedFormat);
    } else {
        alert("Unsupported conversion type.");
    }
}

function convertImage() {
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an image file first.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        imageToConvert.src = event.target.result;

        imageToConvert.onload = function() {
            canvas.width = imageToConvert.width;
            canvas.height = imageToConvert.height;
            ctx.drawImage(imageToConvert, 0, 0);

            const selectedFormat = formatSelect.value;
            let fileExtension = selectedFormat.split('/')[1];
            if (fileExtension === 'jpeg') fileExtension = 'jpg';

            const dataURL = canvas.toDataURL(selectedFormat, 0.9);

            const link = document.createElement("a");
            link.href = dataURL;
            link.download = `converted-${Date.now()}.${fileExtension}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    };

    reader.readAsDataURL(file);
}

async function convertWithFFmpeg(file, targetFormat) {
    try {
        showConversionStatus(true);
        
        // Load FFmpeg if not already loaded
        if (!isFFmpegLoaded) {
            statusText.textContent = 'Loading FFmpeg core...';
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            isFFmpegLoaded = true;
        }
        
        statusText.textContent = 'Preparing file...';
        
        const targetExtension = targetFormat.split('/')[1];
        const inputFileName = file.name;
        const outputFileName = `output.${targetExtension}`;
        
        // Write input file to FFmpeg virtual filesystem
        await ffmpeg.FS('writeFile', inputFileName, await fetchFile(file));
        
        statusText.textContent = 'Converting...';
        
        // Build FFmpeg command based on target format
        let ffmpegArgs = [];
        
        if (targetFormat.startsWith('audio/')) {
            // Audio conversion
            if (targetExtension === 'mp3') {
                ffmpegArgs = ['-i', inputFileName, '-q:a', '2', '-map', 'a', outputFileName];
            } else if (targetExtension === 'wav') {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'pcm_s16le', outputFileName];
            } else if (targetExtension === 'aac') {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'aac', '-b:a', '192k', outputFileName];
            } else if (targetExtension === 'flac') {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'flac', outputFileName];
            } else if (targetExtension === 'ogg') {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'libvorbis', outputFileName];
            } else if (targetExtension === 'm4a') {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'aac', '-b:a', '192k', outputFileName];
            } else {
                ffmpegArgs = ['-i', inputFileName, '-c:a', 'libmp3lame', outputFileName];
            }
        } else if (targetFormat.startsWith('video/')) {
            // Video conversion
            if (targetExtension === 'mp4') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', outputFileName];
            } else if (targetExtension === 'webm') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libvpx-vp9', '-c:a', 'libopus', outputFileName];
            } else if (targetExtension === 'avi') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libxvid', '-c:a', 'mp3', outputFileName];
            } else if (targetExtension === 'mov') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputFileName];
            } else if (targetExtension === 'mkv') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libx264', '-c:a', 'aac', outputFileName];
            } else if (targetExtension === 'mpeg') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'mpeg1video', '-c:a', 'mp2', outputFileName];
            } else if (targetExtension === 'flv') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'flv', '-c:a', 'aac', outputFileName];
            } else if (targetExtension === 'wmv') {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'wmv2', '-c:a', 'wmav2', outputFileName];
            } else {
                ffmpegArgs = ['-i', inputFileName, '-c:v', 'libx264', '-c:a', 'aac', outputFileName];
            }
        }
        
        // Execute FFmpeg command
        await ffmpeg.run(...ffmpegArgs);
        
        statusText.textContent = 'Finalizing...';
        
        // Read the output file
        const data = ffmpeg.FS('readFile', outputFileName);
        const blob = new Blob([data.buffer], { type: targetFormat });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `converted-${Date.now()}.${targetExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showConversionStatus(false);
        
    } catch (error) {
        console.error('Conversion error:', error);
        statusText.textContent = 'Conversion failed';
        showConversionStatus(false);
        alert('Conversion failed: ' + error.message + '\n\nNote: FFmpeg.wasm requires COOP/COEP headers. For local testing, use a server like:\npython -m http.server 8000\nwith proper headers configured.');
    }
}

// ACTION: Reset everything
function clearConverter() {
    fileInput.value = ""; 
    fileNameDisplay.textContent = "Choose File";
    fileNameDisplay.parentElement.style.borderColor = "#d77504";
    fileNameDisplay.parentElement.style.backgroundColor = "#f9f9f9";
    imageToConvert.src = "";
    document.getElementById('videoToConvert').src = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showConversionStatus(false);
}

// Updates Modal - Simple open/close
const updatesButton = document.getElementById('UpdatesButton');
const updatesModal = document.getElementById('updatesModal');

// Open modal when updates button clicked
updatesButton.addEventListener('click', () => {
    updatesModal.style.display = 'block';
});

// Close modal function
function closeUpdatesModal() {
    updatesModal.style.display = 'none';
}

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === updatesModal) {
        closeUpdatesModal();
    }
});