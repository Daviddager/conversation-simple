/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var ibmdb = require( 'ibm_db' );

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  // url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: Conversation.VERSION_DATE_2017_04_21
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    var regex = new RegExp( /3\d{2}(-| )?\d{3}(-| )?\d{4}/);
    if( response.context.service != "none" && regex.test( input.input.text ) ){
      getPhoneNumber( response );
    }
    // var saldo = '$300';
    // var output = response.output.text[0];
    // response.output.text[0] = output.replace( "_saldo_", saldo );
    return response;
  }

  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

function getPhoneNumber( response ){
  var phoneNumber = [];
  for( var i = 0; i < response.entities.length; i++ ){
    if( response.entities[i].entity === 'sys-number' ){
      phoneNumber.push( response.entities[i].value );
    }
  }
  phoneNumber = phoneNumber.join("");
  phoneNumber = phoneNumber.replace(/-/g, "");
  var result = consult( phoneNumber );
  console.log( result );
  var c = 0;
  for( var i = 0; i < 10000000; i++ ){
    c += 1;
  }
  if( result === "NoConn" ){
    response.output.text[0] = "No pude conectarme a la Base de datos, intenta más tarde por favor";
  }
  if( result === "NoData" ){
    response.output.text[0] = "No se encuentra ese número en a base de datos";
  }else{
    if( result != undefined ){

      switch( response.context.service ){
        case "datos":
          var saldo = result.CAPACIDAD;
          var output = response.output.text[0];
          response.output.text[0] = output.replace( "_saldo_", saldo );
          break;
        case "sms":
          var saldo = rows.MENSAJES;
          var output = response.output.text[0];
          response.output.text[0] = output.replace( "_saldo_", saldo );
          break;
        case "minutos":
          var saldo = rows.MINUTOS;
          var output = response.output.text[0];
          response.output.text[0] = output.replace( "_saldo_", saldo );
          break;
        case "paquete":
          var saldo = rows;
          var output = response.output.text[0];
          response.output.text[0] = output.replace( "_saldo_", saldo );
          break;

      }
    }
  }
  return response;
}

function connect(){
  var dbConnString = "DRIVER={DB2};DATABASE=BLUDB;HOSTNAME=dashdb-txn-small-yp-sjc03-01.services.dal.bluemix.net;PORT=50000;PROTOCOL=TCPIP;UID=bluadmin;PWD=ZWYwOTZhNTUzNTIx";
  ibmdb.open( dbConnString, function( err, conn ){
    if( err ){
      console.error( "Error: ", err );
      return "NoConn";
    }else{
      return conn;
      } );
}

function closeConn( conn ){
  conn.close( function(){
    console.log( "Connection closed successfully." );
  } );
}

function consult( phone_number ){
  var dbConnString = "DRIVER={DB2};DATABASE=BLUDB;HOSTNAME=dashdb-txn-small-yp-sjc03-01.services.dal.bluemix.net;PORT=50000;PROTOCOL=TCPIP;UID=bluadmin;PWD=ZWYwOTZhNTUzNTIx";
  ibmdb.open( dbConnString, function( err, conn ){
    if( err ){
      console.error( "Error: ", err );
      return "NoConn";
    }else{
      var query = "SELECT * FROM PLAN WHERE TELEFONO = ";
      query = query.concat( phone_number );
      conn.query( query, function( err, rows ){
        if( err ){
          console.log( "Error: ", err );
          return;
        }else{
          if( rows === "[]" ){
            return "NoData";
          }else{
            //console.log( rows );
            return rows;
          }
          conn.close( function(){
            console.log( "Connection closed successfully." );
          } );
        }
      } );
    }
  } );
}

module.exports = app;
