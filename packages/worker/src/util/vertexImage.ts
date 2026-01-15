import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import { env } from '@app/shared/env';
import path from 'path';

// 1. Get the path from our env object
const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS|| process.env.GOOGLE_APPLICATION_CREDENTIALS;

// 2. Initialize the client inside a function or with a check 
// so it doesn't crash the whole app on import if the path is missing.
const createClient = () => {
  if (!keyPath) {
    console.error("DEBUG: env object says:", env.GOOGLE_APPLICATION_CREDENTIALS);
    console.error("DEBUG: process.env says:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not defined in the environment.");
  }
  const location ='us-central1';

  return new PredictionServiceClient({
    // apiEndpoint: `${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com`,
    apiEndpoint: `${location}-aiplatform.googleapis.com`,
    keyFilename: keyPath,
  });
};

export async function generateVertexImage(
  prompt: string, 
  base64Images: string[]
): Promise<string> {
  const client = createClient(); // Initialize here

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT;
  const location = 'us-central1';
  
  // Try the most generic Imagen 3 ID
  const modelId = 'imagen-3.0-capability-001';
  
  const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`;

  const instance = helpers.toValue({
  prompt: `${prompt} [1]`,
  referenceImages: [
    {
      referenceId: 1,
      referenceType: "REFERENCE_TYPE_SUBJECT",
      subjectDescription: "person",
      // Note: 'referenceImage' vs 'image' depends on the specific SDK version
      // For the capability model, this structure is the most stable:
      referenceImage: {
        bytesBase64Encoded: base64Images[0]
      }
    }
    ]
   });
  const parameters = helpers.toValue({
    sampleCount: 1,
    aspectRatio: "1:1",
    personGeneration: "allow_all",
    guidanceScale: 30,
    safetySetting: "BLOCK_ONLY_HIGH",
  });

  if (!instance) {
    throw new Error('Failed to create instance for Vertex AI');
  }

  const [response] = await client.predict({
    endpoint,
    instances: [instance],
    parameters,
  });
  console.log('[Vertex Debug] Full Response:', JSON.stringify(response, null, 2));

  const predictions = response.predictions as any[];
  
  if (!predictions || predictions.length === 0) {
    throw new Error('No predictions returned from Vertex AI');
  }

  // Google SDK uses a 'structValue' wrapper. We need to extract the actual string.
  // Based on your log, the path is: predictions[0].structValue.fields.bytesBase64Encoded.stringValue
  const result = predictions[0];
  let imageBase64 = '';

  if (result.bytesBase64Encoded) {
    imageBase64 = result.bytesBase64Encoded;
  } else if (result.structValue?.fields?.bytesBase64Encoded?.stringValue) {
    imageBase64 = result.structValue.fields.bytesBase64Encoded.stringValue;
  }

  if (!imageBase64) {
    console.log('[Vertex Debug] Could not find bytes in:', JSON.stringify(result, null, 2));
    throw new Error('No image bytes found in the Vertex AI response');
  }

  return imageBase64;
}