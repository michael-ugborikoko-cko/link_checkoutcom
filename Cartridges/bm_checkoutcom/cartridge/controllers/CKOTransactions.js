'use strict';

/* API Includes */
var ISML = require('dw/template/ISML');

/* Checkout.com Helper functions */
var CKOHelper = require('~/cartridge/scripts/helpers/CKOHelper');

/**
 * Get the transactions list
 */
function listTransactions() {
    // Render the template
    ISML.renderTemplate('transactions/list');
}

/**
 * Get the transactions table data
 */
function getTransactionsData() {
    // Prepare the output array
    var data = CKOHelper.getCkoTransactions();

    // Send the AJAX response
    //eslint-disable-line
    response.writer.println(JSON.stringify(data));
}

/**
 * Perform a remote Hub Call
 */
function remoteCall() {
    // Get the operating mode
    var mode = CKOHelper.getValue('ckoMode');

    // Get the transaction task
    //eslint-disable-line
    var task = request.httpParameterMap.get('task');

    // Prepare the payload
    var gRequest = {
        amount: CKOHelper.getFormattedPrice(request.httpParameterMap.get('amount').stringValue), //eslint-disable-line
        chargeId: request.httpParameterMap.get('pid').stringValue, //eslint-disable-line
    };

    // Set the service parameter
    var serviceName = 'cko.transaction.' + task + '.' + mode + '.service';

    // Log the payment request data
    CKOHelper.log(
        CKOHelper._('cko.request.data', 'cko') + ' - ' + serviceName,
        gRequest
    );

    // Perform the request
    var gResponse = CKOHelper.getGatewayClient(
        serviceName,
        gRequest
    );

    // Log the payment response data
    CKOHelper.log(
        CKOHelper._('cko.response.data', 'cko') + ' - ' + serviceName,
        gResponse
    );

    // Return the response
    //eslint-disable-line
    response.writer.println(JSON.stringify(gResponse));
}

/*
* Web exposed methods
*/

listTransactions.public = true;
getTransactionsData.public = true;
remoteCall.public = true;

exports.ListTransactions = listTransactions;
exports.GetTransactionsData = getTransactionsData;
exports.RemoteCall = remoteCall;
