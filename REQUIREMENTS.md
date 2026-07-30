The puspose of the project is to assesset the autonomy level of the Network. TMF defined the autonomz level from 0-5, where o means no automation / compelete manual and level 5 means fully autnomous network. The CSPs wants to know the autonomoy level of the network.

There are different Type of Networks. They are:
    RAN, Core, IP, Transoport, Fixed Access
TM Forum also defined Few High Valued Secnario (HVS), which are:
    Network Layer: Network Fault Management, Network Change Management, Quality Management, Energy Management, Resource Management, Network Planning, Network Deployment 
    Service Layer: Service Assurance, Complaint Handeling, Service Delivery,Service MArketing, Service Fault Management

There are questionaries for all of the HVS to assess the level. But till now the only ready questionalries are:
    1. RAN Fault Management (GB1059A), Core Network Fault Management (GB1059B)
    But many of the questionaries for other HVS are still in progress or not ready yet. In future, they will be available. 

So the Initial scopes are only the ready documents. That means RAN Fault Management (GB1523A), Core Network Fault Management (GB1523B)


RAN Fault Management (GB1059A):

There is an excel file called RAN_FM. This File has 4 Tabs. 

One is Guideline. This section provides the guideline of the answers of the questions. Here we  will find Cognitive Activity (IAADE), Service Capability	Question, Answering Guideline and information about Sub-scenarios.		

Sub-scenarios:		
The sub-scenarios are introduced based on the alarmType defined in 3GPxP TS 28.111. Below is the list of most common representative sub-scenarios for RAN fault management:			
    Sub-scenario-1:Equipment：An alarm/fault of this type is associated with an equipment fault.			
    Sub-scenario-2:Processing Error: An alarm/fault of this type is associated with a software or processing fault.			
    Sub-scenario-3:Communications: An alarm/fault of this type is associated with the procedure and/or process required conveying information from one point to another.			
    Sub-scenario-4:Environmental: An alarm/fault of this type is associated with a condition related to an enclosure in which the equipment resides.			
    Sub-scenario-5:Security: An alarm/fault of this type is associated with a security attack has been detected by a security service or mechanism.			

Second one is RAN_FM_Q:
2nd Tab is RAN_FM_Q. This section contains the questions and the answering option of all the questions. 
All the questions has the different weights and the sub sections also has the different weight. Here all the questions has been answered with A, B,C, D for the sack of calculation demonestration.

Third one is Scoring:
Scoring is the 3rd tab. Here the criteria section has the value 0,1,2,3,4 which is based on the option selection of the RAN_FM_Q tab, which is also visible in the answer section of this Scoring tab. There are formulas from column O to column AD. which are used for the calculation. 

And forth one is E2E_Checklist:
This tab consist a table where subsectins are in Horizontal and Service Capabilities are in Vertical. Here Column C to G also has the formula, which define the system or person. Here row 13 provides an example of 70% e2e Automation ratio. 

Current Process:
We are the memebr of the TM Forum and expert consultant of the Autonomous Network. At this moment we send this excel to the users of our client. For example we send this excel to 10 RAN Engineers and then they select the option (A,B,C,D) to answer the question and send it to us. Then we collect their 10 different excel sheet and create an accumulated result from 10 individuals. Later we create a chart for the executive presentation. We do this repeatitive task for all of our clients. We store the responses and the result from different client company in different folders. Whenever we want to create a benchmark or a comparison chart or result comparison then we go individual folders of the client and collect the result manually. 

Expected new Process:
I want to have an cloud based application, which I want to depoly in GCP. There are 3 users gropus. 
Group1_Normal_Users: 
This group can login the application with prdefined username & Password and choose the options of the answers of the question like the lab RAN_FM_Q. Then the result will be calculated with same formula of tab Scoring of the RAN_FM excel sheet. At the end of the answer, the user can see the result dashboard just like E2E_Checklist as well as the final score of all service Capability and sub scenarios. At the very end that person submit the response.

Group2_Executive:
This group can see the response of the individula person of the same organization. This group can deep dive and go through all the questions and the answer of each questions. Example: How many person choose Option A for question 1, How many for option B and so on. This level of details they can see but only for the same organization. 

Group3_Admin:
This group has the maximum right and control of the application. They can create organization and assign the specific right to Group2_Executive and Group1_Normal_Users. The admin can see all the informations like the response and final result for all organization. There will be an admin dashboard which will be used to beanchmark the result of the different organization. 

The benefit of the new expected process is that it will be application based and rid of excel dependency. It will help to create the benchmarking without manually collecting data


I want to use the stacks below for the whole projects:
Frontend
React + TypeScript
Backend
Node.js + Express
Database
Cloud SQL PostgreSQL
Database access
Prisma ORM
Hosting
Google Cloud Run
Container
Docker
Secrets
Google Secret Manager

