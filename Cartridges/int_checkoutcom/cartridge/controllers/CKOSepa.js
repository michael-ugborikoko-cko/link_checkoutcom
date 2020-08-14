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
    var orderId = ckoHelper.getOrderId();
    var order = OrderMgr.getOrder(orderId);

    // Process the URL
    if (url) {
        app.getView({
            // Prepare the view parameters
            creditAmount: order.totalGrossPrice.value.toFixed(2),
            formatedAmount: ckoHelper.getFormattedPrice(order.totalGrossPrice.value.toFixed(2), ckoHelper.getCurrency()),
            debtor: order.billingAddress.fullName,
            debtorAddress1: order.billingAddress.address1,
            debtorAddress2: order.billingAddress.address2,
            debtorCity: order.billingAddress.city,
            debtorPostCode: order.billingAddress.postalCode,
            debtorStateCode: order.billingAddress.stateCode,
            debtorCountryCode: order.billingAddress.countryCode.toString().toLocaleUpperCase(),

            // Prepare the creditor information
            creditor: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessName')),
            creditorAddress1: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessAddressLine1')),
            creditorAddress2: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessAddressLine2')),
            creditorCity: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessCity')),
            creditorCountry: ckoHelper.upperCaseFirst(ckoHelper.getValue('ckoBusinessCountry')),
            ContinueURL: URLUtils.https('CKOSepa-HandleMandate'),
        }).render('sepaForm');
    } else {
        // Write the response
        return ckoHelper.ckoResponse(ckoHelper._('cko.sepa.error', 'cko'));
    }

    return null;
}

/**
 * Confirms the mandate
 */
function handleMandate() {
    var orderId = ckoHelper.getOrderId();
    app.getForm('sepaForm').handleAction({
        cancel: function() {
            // Clear form
            app.getForm('sepaForm').clear();

            if (orderId) {
                // Load the order
                var order = OrderMgr.getOrder(orderId);
                OrderMgr.failOrder(order, true);
            }

            app.getController('COBilling').Start();
        },
        submit: function() {
            var sepa = app.getForm('sepaForm');
            var mandateValue = sepa.get('mandate').value();

            // If mandate is true
            if (mandateValue) {
                // Clear form
                app.getForm('sepaForm').clear();

                // Set session redirect url to null
                // eslint-disable-next-line
                session.privacy.redirectUrl = null;

                // Get the response object from session
                // eslint-disable-next-line
                var responseObjectId = session.privacy.sepaResponseId;

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
                    var sepaRequest = apmHelper.handleSepaControllerRequest(payObject, order);
                    if (apmHelper.handleApmChargeResponse(sepaRequest, order)) {
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
