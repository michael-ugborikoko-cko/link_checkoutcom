/**
 * Klarna controller.
 */

'use strict';

/* Server */
var server = require('server');
server.extend(module.superModule);

/* API Includes */
var BasketMgr = require('dw/order/BasketMgr');

/** Utility **/
var ckoHelper = require('~/cartridge/scripts/helpers/ckoHelper');

/**
 * Initiate the Kalrna session.
 */
server.get('KlarnaSession', function (req, res, next) {
    // Prepare the basket
    var basket = BasketMgr.getCurrentBasket();
    if (basket) {
        // Prepare the variables
        var countryCode = ckoHelper.getBasketCountyCode(basket);
        var currency = basket.getCurrencyCode();
        var locale = ckoHelper.getLanguage();
        var total = ckoHelper.getFormattedPrice(basket.getTotalGrossPrice().value, currency);
        var tax =  ckoHelper.getFormattedPrice(basket.getTotalTax().value, currency);
        var products = ckoHelper.getBasketObject(basket);
        var billing = ckoHelper.getBasketAddress(basket);
        
        // Prepare the request object
        var requestObject = {
            "purchase_country": countryCode,
            "currency"              : currency,
            "locale"                : locale,
            "amount"                : total,
            "tax_amount"            : tax,
            "products"              : products,
            "billing_address"       : billing
        }
        
        // Perform the request to the payment gateway
        var gSession = ckoHelper.gatewayClientRequest(
            'cko.klarna.session.' + ckoHelper.getValue('ckoMode') + '.service',
            requestObject
        );
        
        // Store variables in session
        gSession.requestObject = requestObject;
        gSession.addressInfo = ckoHelper.getBasketAddress(basket);

        // Write the session
        if (gSession) {
            res.getWriter().println(JSON.stringify(gSession));
        }
    } else {
        res.getWriter().println('Basket Not Found');
    }

    next();
});

/*
 * Module exports
 */
module.exports = server.exports();