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
        statusText.textContent = 'Uploading file to server...';
        updateProgress(10);

        const targetExtension = targetFormat.split('/')[1];
        
        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('targetFormat', targetFormat);

        // Upload and convert
        const response = await fetch(`${API_URL}/convert`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Conversion failed');
        }

        statusText.textContent = 'Processing on server...';
        updateProgress(50);

        // Get the converted file as blob
        const blob = await response.blob();
        
        statusText.textContent = 'Downloading...';
        updateProgress(90);

        // Create download link
        const url = URL.createObjectURL(blob);
        const contentDisposition = response.headers.get('content-disposition');
        const filename = contentDisposition ? 
            contentDisposition.split('filename=')[1]?.replace(/["']/g, '') : 
            `converted-${Date.now()}.${targetExtension}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        updateProgress(100);
        showConversionStatus(false);
        
    } catch (error) {
        console.error('Conversion error:', error);
        statusText.textContent = 'Conversion failed';
        showConversionStatus(false);
        alert('Conversion failed: ' + error.message + '\n\nMake sure the server is running at ' + API_URL);
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