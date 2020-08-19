'use strict';

// Script Modules
var Site = require('dw/system/Site');
var siteControllerName = Site.getCurrent().getCustomPreferenceValue('ckoSgStorefrontControllers');
var app = require(siteControllerName + '/cartridge/scripts/app');
var guard = require(siteControllerName + '/cartridge/scripts/guard');
var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var OrderMgr = require('dw/order/OrderMgr');

// Utility
var ckoHelper = require('~/cartridge/scripts/helpers/ckoHelper');
var apmHelper = require('~/cartridge/scripts/helpers/apmHelper');

/**
 * Initiate the mandate session.
 * @returns {Object} The gateway response
 */
function mandate() {
    // Prepare the varirables
    // eslint-disable-next-line
    var url = session.privacy.redirectUrl;

    // Process the URL
    if (url) {
        app.getView({

            // Prepare the creditor information
            creditor: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessName')),
            ContinueURL: URLUtils.https('CKOAch-HandleMandate'),
        }).render('achForm');
    } else {
        // Write the response
        return ckoHelper.ckoResponse(ckoHelper._('cko.ach.error', 'cko'));
    }

    return null;
}

/**
 * Confirms the mandate
 */
function handleMandate() {
    var orderId = ckoHelper.getOrderId();
    app.getForm('achForm').handleAction({
        cancel: function() {
            // Clear form
            app.getForm('achForm').clear();

            if (orderId) {
                // Load the order
                var order = OrderMgr.getOrder(orderId);
                OrderMgr.failOrder(order, true);
            }

            app.getController('COBilling').Start();
        },
        submit: function() {
            var ach = app.getForm('achForm');
            var mandateValue = ach.get('mandate').value();

            // If mandate is true
            if (mandateValue) {
                // Clear form
                app.getForm('achForm').clear();

                // Set session redirect url to null
                // eslint-disable-next-line
                session.privacy.redirectUrl = null;

                // Get the response object from session
                // eslint-disable-next-line
                var responseObjectId = session.privacy.achResponseId;

                // Load the order
                var order = OrderMgr.getOrder(orderId);
                if (responseObjectId) {
                    // Prepare the payment object
                    var payObject = {
                        source: {
                            type: 'id',
                            id: responseObjectId,
                        },
                        amount: ckoHelper.getFormattedPrice(order.totalGrossPrice.value.toFixed(2), ckoHelper.getCurrency()),
                        currency: ckoHelper.getCurrency(),
                        reference: orderId,
                    };

                    // Reset the response in session
                    // eslint-disable-next-line
                    session.privacy.sepaResponseId = null;

                    // Handle the SEPA request
                    var achRequest = apmHelper.handleAchControllerRequest(payObject, order);
                    if (apmHelper.handleApmChargeResponse(achRequest, order)) {
                        // Show the confirmation screen
                        app.getController('COSummary').ShowConfirmation(order);
                    } else {
                        // Return to the billing start page
                        app.getController('COBilling').Start();
                    }
                } else {
                    // Restore the cart
                    OrderMgr.failOrder(order, true);

                    // Send back to the error page
                    ISML.renderTemplate('custom/common/response/failed.isml');
                }
            } else {
                // load the mandate form
                mandate();
            }
        },
    });
}

// Module exports
exports.Mandate = guard.ensure(['get', 'https'], mandate);
exports.HandleMandate = guard.ensure(['post', 'https'], handleMandate);
