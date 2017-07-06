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
var conn = connectToDB();

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
    updateMessage(payload, data, function( err, result ){
      res.json( result );
    } );
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response, callback) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  }
  else {
    // Regular Expression to validate a phone number
    var regex = new RegExp( /3\d{2}(-| )?\d{3}(-| )?\d{4}/);
    if( response.context.service != "none" && regex.test( input.input.text ) ){
      var phoneNumber = [];
      for( var i = 0; i < response.entities.length; i++ ){
        if( response.entities[i].entity === 'sys-number' ){
          phoneNumber.push( response.entities[i].value );
        }
      }
      // Trim spaces and Hypens if any from the phone number
      phoneNumber = phoneNumber.join("");
      phoneNumber = phoneNumber.replace(/-/g, "");
      // TODO: Changebind query to prepared statement and binded parameters
      var query = "SELECT * FROM PLAN WHERE TELEFONO = ";
      // TODO: Remove query concat
      query = query.concat( phoneNumber );
      // TODO: Change query to execute statement
      conn.query( query, function( err, rows ){
        if( err ){
          console.log( "Error: ", err );
          callback( err, null );
          return;
        }else{
          if( !rows ){
            callback( "No Data", null );
          }else{
            var output = response.output.text[0];
            switch( response.context.service ){
              case 'datos':
                output = output.replace( '_saldo_', rows[0].CAPACIDAD );
                break;
              case 'sms':
                output = output.replace( '_saldo_', rows[0].MENSAJES );
                break;
              case 'minutos':
                output = output.replace( '_saldo_', rows[0].MINUTOS );
                break;
              case 'paquete':
                output = output.replace( '_nombre_', rows[0].NOMBRE );
                output = output.replace( '_datos_', rows[0].CAPACIDAD );
                output = output.replace( '_minutos_', rows[0].MINUTOS );
                output = output.replace( '_mensajes_', rows[0].MENSAJES );
                output = output.replace( '_fecha_', rows[0].FECHACORTE );
                if( !rows[0].EXTRA ){
                  output = output.replace( '_extra_', '' );
                }
                else{
                  output = output.replace( '_extra_', rows[0].EXTRA );
                }
                break;
            }
            response.output.text[0] = output;
            callback( null, response );
          }
        }
      } );
    }else{
       callback( null, response );
    }
  }
}

function connectToDB(){
  var dbConnString = process.env.DBSTRING;
  ibmdb.open( dbConnString, function( err, conn ){
    if( err ){
      console.error( "Error: ", err );
      return "NoConn";
    }else{
      setConnection( conn );
    }
  } );
}

function setConnection( connection ){
  conn = connection;
}

function closeConn(){
  conn.close( function(){
    console.log( "Connection closed successfully." );
  } );
}

module.exports = app;
