# PerfectBlend: MLOps Hackathon Project
**Role:** You are a Senior ML Systems Engineer acting as my technical co-founder. 
**Goal:** We are building "PerfectBlend," an MLOps tooling web app that helps address class bias in ML finetuning, specifically for CV applications, by examining the current training data class proportions. The app will confirm it can locate the dataset and its json. The app gets user to enter the purpose of finetuning the CV model. App sends this data to an genAI API that returns whether the data might have class bias and how many annotations of each class should be in the ideal dataset. Then the app visualizes the original dataset composition and the ideal dataset composition. The app can then either downsample or upsample the dataset to create the perfect blend! The researcher/developer can use the dataset to train their model now. 

## Target Hackathon Tracks & Grading Rubric
We are optimizing the architecture, tech, and UX to win the following tracks:
1. **Best AI Hack using IBM Technology:** Must use an IBM Cloud service (we have an IBM Cloud API key for watsonx.ai which we can use to access maybe a llama model?). Must address a real business challenge in the Research sector (improving data annotation workflows). Must demonstrate responsible and secure AI practices (human-in-the-loop oversight, not just blindly accept AI's suggestions).
2. **Bitdeer Beyond the Prototype:** Must be a high-performance, production-ready tool. We are solving real-world pain points for ML engineers by creating a polished, technically impressive project bridging the gap between side projects and professional-grade engineering.
3. **GenAI Genesis Top Overall:** Utilizing generative AI ingeniously for human empowerment. 

## Tech Stack
* **Open:** I want you to suggest the most efficient, lightweight, and ideal modern tech stack to build this as a single-page web app within a 36-hour hackathon constraint. Keep in mind I am a solo developer. 
* **AI Integration:** IBM `watsonx.ai` 

## Architecture & Logic Flow Requirements
The application must execute the following sequential flow:

1. **Data Ingestion (The Pantry):** * The user enters the directory of their dataset folder. Inside, there should be images alongside the corresponding json containing coco annotations. LMK if there is'a better way. 

2. **Data Parsing (Image-Level Granularity):**
   * Parse the JSON to extract class counts *per specific image* rather than a global aggregate. 
   * Format needed: `{"image_id": "img_001", "class_name": "Live Scallop", "count": 15}`. Then, I will need the globla aggregate to send off to AI to see if its proportion is correct.

3. **Visualization (The Raw State):**
   * Render a highly interactive "packed bubble chart".
   * *Crucial Rule:* Each circle represents a class *within one specific image*. The color represents the `class_name` (e.g., Scallops = Red, Gunnels = Blue). The radius represents the `count` of that organism in that specific image. 

4. **AI Strategy Generation (watsonx.ai):**
   * A button triggers a prompt to Watsonx: "Analyze this class distribution for finetuning a CV model for xyz-user-entered-purpose and determine whether there is class bias. Return a strategy to balance the dataset if there is class bias, whether the strategy is downsampling the majority or upsampling/augmenting the minority." The prompt is not final.

5. **Human-in-the-Loop Override (Responsible AI):**
   * The app must display the AI's numerical targets and allow the researcher to manually tweak the inputs that AI suggested before applying the changes. This proves our "Secure and Responsible AI" metric for the IBM track.

6. **Execution & Export:**
   * Duplicate the original dataset and physically modify the JSON object and associated images (e.g., duplicating minority class entries and performing data augmentation, reducing majority entries based on the targets). This must follow proven upsampling and downsampling techniques known to eliminate bias. 
   * Output the new ideal dataset in a user-selected directory. 

**NOTES:** 
* Ensure the code is modular and clean
* Make sure unexpected data deletion/creation does not occur