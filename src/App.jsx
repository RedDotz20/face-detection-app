import { useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';

export default function App() {
  const videoRef = useRef();
  const canvasRef = useRef();

  // LOAD FROM USEEFFECT
  useEffect(() => {
    startVideo();
    videoRef && loadModels();
  }, []);

  // OPEN YOU FACE WEBCAM
  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((currentStream) => {
        videoRef.current.srcObject = currentStream;
      })
      .catch((err) => {
        console.log(err);
      });
  };

  // LOAD MODELS FROM FACE API
  const loadModels = () => {
    Promise.all([
      // THIS FOR FACE DETECT AND LOAD FROM YOU PUBLIC/MODELS DIRECTORY
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    ]).then(() => {
      faceMyDetect();
    });
  };

  const faceMyDetect = () => {
    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      // DRAW YOU FACE IN WEBCAM
      canvasRef.current.innerHtml = faceapi.createCanvasFromMedia(
        videoRef.current
      );
      faceapi.matchDimensions(canvasRef.current, {
        width: 940,
        height: 650,
      });

      const resized = faceapi.resizeResults(detections, {
        width: 940,
        height: 650,
      });

      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
      faceapi.draw.drawFaceExpressions(canvasRef.current, resized);
    }, 1000);
  };

  return (
    <div className="myapp">
      <h1>FACE DETECTION</h1>
      <div className="appvide">
        <video
          crossOrigin="anonymous"
          ref={videoRef}
          height={650}
          width={940}
          autoPlay
        ></video>
        <canvas
          ref={canvasRef}
          height={650}
          width={940}
          className="appcanvas"
        />
        <div className="vidBackground"></div>
      </div>
    </div>
  );
}
