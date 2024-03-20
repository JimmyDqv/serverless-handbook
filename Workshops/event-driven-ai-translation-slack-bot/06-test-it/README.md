# Test the setup

In this section you will test the entire setup and learn more about the flow.

## Send command

From the Slack channel that you have created run this command to start a translation: '/translate "Hello! How are you? This is an automatic translation." sv-SE, fr-FR'
This should, if everything is correctly setup, create a translation back to the channel and the audio for it.

![image showing test result](images/slack-response.png)

## Check StepFunction runs

Next, inspect each StepFunction and the invocation. Navigate to StepFunctions in the console.
![image showing stepfunctions in console](images/locate-stepfunctions.png)

Find the Translate StepFunction in the list and click it.
![image showing stepfunctions list](images/translate-stepfunction.png)

You will see a list of all invocations, click on the latest run.
![image showing stepfunctions invocations](images/translate-stepfunction.png)

Click each of the steps in the flow and look at the input and output data from the step.
![image showing stepfunctions steps](images/inspect-steps.png)

Repeat for all of the StepFunctions to understand what they do, and what data was handled.

## Test additional command

What will happen if you send command '/translate "Hello! How are you?", sv-SE'?
Why do you think this happens?
