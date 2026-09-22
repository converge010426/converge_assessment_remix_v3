import React from 'react';

const Support = () => {
  return (
    <div className="min-h-screen bg-white text-navy">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          CONVERGE Support
        </h1>

        <p className="text-sm text-gray-600 mb-10">
          We are here to help with your CONVERGE assessment and report.
        </p>

        <div className="space-y-8 text-gray-800 leading-relaxed">

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              Assessment support
            </h2>
            <p>
              Contact us if you experience a problem completing your
              assessment, submitting your answers, or receiving your results.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              Report support
            </h2>
            <p>
              If you have completed an assessment but have not received your
              report, please contact us and include the email address used for
              your assessment.
            </p>
            <p className="mt-3">
              Please do not send your assessment answers or other sensitive
              information unless we specifically request it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              Payment and purchase enquiries
            </h2>
            <p>
              For questions concerning a CONVERGE purchase, payment status or
              access to a purchased report, please contact us using the email
              address below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              Privacy and data requests
            </h2>
            <p>
              You can also use this address to ask questions about your
              personal information or to make a privacy or data-protection
              request.
            </p>
            <p className="mt-3">
              For more information, please see our Privacy Policy.
            </p>
          </section>

          <section className="border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold mb-3">
              Contact CONVERGE
            </h2>

            <p>
              Email:
            </p>

            <a
              href="mailto:tomknsn@gmail.com"
              className="inline-block mt-2 text-lg font-semibold text-navy hover:text-gold transition-colors"
            >
              tomknsn@gmail.com
            </a>

            <p className="mt-4 text-sm text-gray-600">
              Please allow reasonable time for a response. When contacting
              support about an existing assessment, using the same email
              address that was used for the assessment will help us locate
              the relevant record.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Support;