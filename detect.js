// Video & canvas
const video = document.querySelector('video');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

// CheckPoints
const showMaskCB = document.querySelector('#showMask');
const showPointsCB = document.querySelector('#showPoints');

// Configure video
video.width = 640;
video.height = 480;
canvas.width = video.width;
canvas.height = video.height;

navigator.mediaDevices.getUserMedia({video: {width: video.width, height: video.height}})
    .then(stream => {
        video.srcObject = stream;
    })

video.onplaying = async () => {
    const net = await bodyPix.load()
    canvas.style.display = "block";
    predict(net)
};


async function predict(net) {
    while (true) {
        const segmentation = await net.segmentPersonParts(video);

        if (segmentation.allPoses[0] === undefined) continue;

        draw(segmentation);
        if (showMaskCB.checked || showPointsCB.checked) continue

        const faceThreshold = 0.9;
        const pose = segmentation.allPoses[0]
        const nose = pose.keypoints[0].score > faceThreshold;
        const leftEye = pose.keypoints[1].score > faceThreshold;
        const rightEye = pose.keypoints[2].score > faceThreshold;
        
        const hasFace = nose && (leftEye || rightEye)
        if (hasFace) {
            const faceArray = segmentation.data.map(segPixel => {
                if (segPixel === 0 || segPixel === 1) return segPixel;
                else return -1;
            });

            const handArray = segmentation.data.map(segPixel => {
                if (segPixel === 10 || segPixel === 11) return segPixel;
                else return -1;
            });

            const faceMatrix = arrayToMatrix(faceArray, segmentation.width);
            const handMatrix = arrayToMatrix(handArray, segmentation.width);
            const touchScore = intersect(faceMatrix, handMatrix, 10);
            
            if (touchScore > 0.1) {
                const bodyPart = [0, 1]
                const blurAmount = 10
                const edgeBlurAmount = 3
                bodyPix.blurBodyPart(
                    canvas, video, segmentation, bodyPart, 
                    blurAmount,edgeBlurAmount);
            }
        }
    }
}

function intersect(facePixels, handPixels, padding) {
    let count = 0;
    facePixels.forEach((_,y) => {
        facePixels[0].forEach( (_, x) => {
            if (facePixels[y][x] > -1) {
                for (let p = 0; p < padding; p++) {
                    if (handPixels[y][x - p] > -1 || handPixels[y][x + p] > -1 ||
                        handPixels[y - p][x] > -1 || handPixels[y + p][x] > -1) {
                        count++;
                    }
                }
            }
        })
    })  
    return count
}

function draw(personSegmentation) {
    if (showMaskCB.checked) {
        const targetSegmentation = personSegmentation;
        //filter face and hand
        targetSegmentation.data = personSegmentation.data.map(val => {
            if (val !== 0 && val !== 1 && val !== 10 && val !== 11)
                return -1;
            else
                return val;
        })

        const coloredPartImage = bodyPix.toColoredPartMask(targetSegmentation);
        const opacity = 0.7;
        const maskBlurAmount = 0;
        bodyPix.drawMask(
            canvas, video, coloredPartImage, 
            opacity, maskBlurAmount);
    }else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (showPointsCB.checked) {
        personSegmentation.allPoses.forEach(pose => {
            drawKeyPoints(pose.keypoints, 0.9);
        });
    }
}

function drawKeyPoints(keypoints, minConfidence, color = 'aqua') {
    keypoints.forEach(keypoint => {
        if (keypoint.score < minConfidence) {
            return;
        }

        const {y, x} = keypoint.position;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

    })
}

function arrayToMatrix(arr, width) {
    return arr.reduce((rows, key, index) => 
        (index % width == 0 ? rows.push([key]) 
        : rows[rows.length-1].push(key)) && rows, []);
}
