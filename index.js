const request = require("request");
const StatsD = require('node-dogstatsd').StatsD;
const dataDogClient = new StatsD('localhost',8125);
const config = require('./config');

const sprintValue = config.sprintId;
const options = {
    method: 'POST',
    url: 'https://pdffiller.atlassian.net/rest/api/3/search',
    headers:
        {
            'Cache-Control': 'no-cache',
            Authorization: 'Basic '+ config.jiraToken,
            'Content-Type': 'application/json'
        },
    body:
        {
            jql: 'project = "Airslate Addons" and Sprint = '+sprintValue,
            fields: ['summary', 'customfield_10008', 'assignee']
        },
    json: true
};

const getNestedObject = (nestedObj, pathArr) => {
    if(typeof pathArr === 'string') {
        pathArr = pathArr.split('.')
    }
    return pathArr.reduce((obj, key) =>
        (obj && obj[key] !== 'undefined') ? obj[key] : undefined, nestedObj);
};

let people = {};
let unassignedIssues = [];
request(options, function (error, response, body) {
    if (error) throw new Error(error);

    for (let i = 0; i < body.issues.length; i++) {
        let issue = body.issues[i];


        let key = getNestedObject(issue, 'fields.assignee.key');
        if(typeof key === 'undefined') {
            unassignedIssues.push(issue);
            continue ;
        }

        if (typeof people[key] !== 'object') {
            people[key] = {
                issues : [],
                totalStoryPoints : 0
            }
        }

        people[key].issues.push({
            'summary' : issue.fields.summary,
            'storyPoints' : issue.fields.customfield_10008
        });

        if(typeof issue.fields.customfield_10008 === 'number') {
            people[key].totalStoryPoints += issue.fields.customfield_10008;
        }
    }

    for (let user in people) {
        let userData = people[user];
        dataDogClient.gauge("addons.storypoints", userData.totalStoryPoints, ['user:'+user,"sprint1:"+ sprintValue]);
        console.log(user, userData.totalStoryPoints);
    }

    // console.log(JSON.stringify(people,null, 2));
    // console.log(JSON.stringify(unassignedIssues,null, 2));
});

