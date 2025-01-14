import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@patternfly/react-core';

const SimpleNext = ({
  next,
  valid,
  handleNext,
  submit,
  nextLabel,
}) => (
  <Button
    variant="primary"
    type="button"
    isDisabled={ !valid }
    onClick={ () => valid ? handleNext(next) : submit() }
  >
    { nextLabel }
  </Button>
);

SimpleNext.propTypes = {
  next: PropTypes.string,
  valid: PropTypes.bool,
  handleNext: PropTypes.func.isRequired,
  submit: PropTypes.func.isRequired,
  nextLabel: PropTypes.string.isRequired,
};

const ConditionalNext = ({
  nextStep,
  FieldProvider,
  ...rest
}) => (
  <FieldProvider
    name={ nextStep.when }
    subscription={{ value: true }}
  >
    { ({ input: { value }}) => <SimpleNext next={ nextStep.stepMapper[value] } { ...rest } /> }
  </FieldProvider>
);

ConditionalNext.propTypes = {
  nextStep: PropTypes.shape({
    when: PropTypes.string.isRequired,
    stepMapper: PropTypes.object.isRequired,
  }).isRequired,
  FieldProvider: PropTypes.func.isRequired,
};

const submitButton = (handleSubmit, submitLabel) => <Button type="button" variant="primary" onClick={ handleSubmit }>{ submitLabel }</Button>;

const renderNextButton = ({ nextStep, handleSubmit, submitLabel, ...rest }) =>
  !nextStep
    ? submitButton(handleSubmit, submitLabel)
    : typeof nextStep === 'object'
      ? <ConditionalNext nextStep={ nextStep } { ...rest }/>
      : <SimpleNext next={ nextStep } { ...rest } />;

const WizardStepButtons = ({
  formOptions,
  disableBack,
  handlePrev,
  nextStep,
  FieldProvider,
  handleNext,
  buttonsClassName,
  buttonLabels: {
    cancel,
    submit,
    back,
    next,
  }}) =>
  <footer className={ `pf-c-wizard__footer ${buttonsClassName ? buttonsClassName : ''}` }>
    { renderNextButton({
      ...formOptions,
      handleNext,
      nextStep,
      FieldProvider,
      nextLabel: next,
      submitLabel: submit,
    }) }
    <Button type="button" variant="secondary" isDisabled={ disableBack } onClick={ handlePrev }>{ back }</Button>
    <Button type="button" variant="link" onClick={ formOptions.onCancel }>{ cancel }</Button>
  </footer>;

WizardStepButtons.propTypes = {
  formOptions: PropTypes.shape({
    onCancel: PropTypes.func.isRequired,
    handleSubmit: PropTypes.func.isRequired,
  }).isRequired,
  disableBack: PropTypes.bool,
  handlePrev: PropTypes.func.isRequired,
  handleNext: PropTypes.func.isRequired,
  nextStep: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      when: PropTypes.string.isRequired,
      stepMapper: PropTypes.object.isRequired,
    }),
  ]),
  FieldProvider: PropTypes.func.isRequired,
  buttonLabels: PropTypes.shape({
    submit: PropTypes.string.isRequired,
    cancel: PropTypes.string.isRequired,
    back: PropTypes.string.isRequired,
    next: PropTypes.string.isRequired,
  }).isRequired,
  buttonsClassName: PropTypes.string,
};

export default WizardStepButtons;
